---
layout: post
title:  "Use Google Translate API through YQL"
categories: php
---

As part of the internationalization of our ecommerce websites, I needed a quick translation script to create some fixtures for tests.
I had to translate shelves, products and descriptions from french to english. First, I looked at the Google Translate API but it was only available as a paid service.
I tried some alternative solutions and it was limited in number. Finally, I just wanted fake data to make some tests. So it was exclude to pay or to be limited after 1000 requests.

Then, I saw it was possible to use the Google API indirectly through YQL.


# YQL

YQL is a language used for Yahoo API. It turns webservices and data on the web into databases and allows you to select, filter, sort and limit data. In our case, we are interested in retrieving Google translations.

Thus to translate from french to english, we use this query:

{% highlight text %}
select * from google.translate where q="bonjour" and source="fr" and target="en"
{% endhighlight %}

And to call the Yahoo API, we use this url:

{% highlight text %}
http://query.yahooapis.com/v1/public/yql?
{% endhighlight %}

Followed by these parameters:

{% highlight text %}
q = [ YQL QUERY ]
format = [ XML / JSON ]
diagnostics = [ true / false ]
debug = [ true / false ]
callback = [ function name ]
{% endhighlight %}


# PHP sample

Lastly, here is the code I used to run an automatic translation:

{% highlight php %}
<?php

trait autoTranslate
{
    protected
        $lang1,
        $lang2
    ;
    
    protected function translate($text)
    {
        if ($text == "") return "";
        
        $translatedText = iconv('UTF-8', 'US-ASCII//TRANSLIT', $text);
        
        $url = "http://query.yahooapis.com/v1/public/yql";
        $query = rawurlencode("select * from google.translate where q=\"{$translatedText}\" and source=\"{$this->lang1}\" and target=\"{$this->lang2}\";");
        $return = $this->get("{$url}?q=$query&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys");
        $results = json_decode($return);
        
        if (is_array($results->query->results->json->sentences)) {
            $translationArray = array();
            foreach ($results->query->results->json->sentences as $sentence) {
                $translationArray[] = $sentence->trans;
            }
            
            $translatedText = implode("", $translationArray);
        } else {
            $translatedText = $results->query->results->json->sentences->trans;
        }
        
        if ($translatedText == "") return $text;
        
        return $translatedText;
    }
    
    protected function get($url, array $options = array())
    {
        $defaults = array(
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => false
        );
        
        $ch = curl_init();
        curl_setopt_array($ch, ($options + $defaults));
        if(! $result = curl_exec($ch)) {
            trigger_error(curl_error($ch));
        }
        curl_close($ch);
        
        return $result;
    }
}
{% endhighlight %}