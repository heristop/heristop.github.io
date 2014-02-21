---
layout: post
title:  "Expose Symfony i18n to ExtJS"
categories: symfony
---

<div id="toc"></div>

In previous articles, I explained how to implement ExtJS in a Symfony 2 project, focusing on the [Viewport]({% post_url 2014-02-04-extjs-with-symfony-part1 %}) and the [Proxy]({% post_url 2014-02-09-extjs-with-symfony-part2 %}).

Now it's time to see one of the advantages of this marriage: expose your Symfony translation messages to your ExtJS application.

# Translation file

First, create a translation file in the `Resources/translations/` directory of your bundle.
You can use the default domain `messages` or specify an other domain.
In the example below, I created a file for the French:

{% highlight xml %}
<!-- Resources/translations/messages.fr.xliff -->
<?xml version="1.0"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file source-language="en" datatype="plaintext" original="file.ext">
        <body>
            <trans-unit id="1">
                <source>Close</source>
                <target>Fermer</target>
            </trans-unit>
            <trans-unit id="2">
                <source>Close this window</source>
                <target>Fermer la fenêtre</target>
            </trans-unit>
        </body>
    </file>
</xliff>
{% endhighlight %}

**Note:** Symfony provides others loaders than XLIFF, including PHP and YAML.

# Translations in JS

Now to expose your translations to the javascript, install the bundle `JsTranslationBundle`.
For that, add this requirement in your composer configuration file:

{% highlight json %}
"require": {
    ...
    "willdurand/js-translation-bundle": "2.0.*"
    ...
},
{% endhighlight %}

Then, register the bundle in `app/AppKernel.php`:

{% highlight php %}
<?php
// app/AppKernel.php
public function registerBundles()
{
    return array(
        // ...
        new Bazinga\Bundle\JsTranslationBundle\BazingaJsTranslationBundle(),
    );
}
{% endhighlight %}

**Protip:** For more configuration, see the bundle documentation: [JsTranslationBundle](https://github.com/willdurand/BazingaJsTranslationBundle/blob/master/Resources/doc/index.md).


To dump the translations in javascript, run this command:

{% highlight sh %}
app/console bazinga:js-translation:dump
{% endhighlight %}

It generates the file below in `js/translations`:

{% highlight js %}
// fr.js
(function (Translator) {
    // fr
    Translator.add("Close", "Fermer", "messages", "fr");
    Translator.add("Close this window", "Fermer la fenêtre", "messages", "fr");
})(Translator);
{% endhighlight %}

Then, include this file and the `Translator` with Assetic:

{% highlight html %}
{ % javascripts
    'bundles/bazingajstranslation/js/translator.min.js'
    'js/translations/config.js'
    'js/translations/messages/*.js'
    ...
% }
    <script src="{ { asset_url } }"></script>
{ % endjavascripts % }
{% endhighlight %}

By default, the locale is set to the value defined in the lang attribute of the html tag:

{% highlight html %}
<!doctype html>
<html lang="{ { app.request.locale } }">
...
{% endhighlight %}

Now you can use the translation within ExtJS!

Let's try with a simple dialog window:

{% highlight js %}
Ext.Msg.show({
    closable: false,
    title: Translator.trans('Close', {}, "messages"),
    msg: Translator.trans('Close this window', {}, "messages"),
    buttons: Ext.Msg.OK,
    icon: Ext.Msg.INFO
});
{% endhighlight %}

If the language of the user's locale is French, it will display this message:

![screenshot](/images/posts/screen_msgalertfr.png)


# ExtJS locales

Assetic has a great feature to produce different outputs for the same asset: `variables`.
Asset variables are very useful to include ExtJS language files depending on user's locale.

In practice, specify the possible languages for the asset variable `locale`:

{% highlight yaml %}
# app/config/config.yml
assetic:
    variables:
        locale:     [ en, fr ]
{% endhighlight %}

Then, include the locale file with the variable instead of the lang:

{% highlight html %}
{ % javascripts "/bundle/acmefoo/ext/locale/ext-lang-{locale}.js" vars=["locale"] % }
<script language="javascript" type="text/javascript" src={ { asset_url } }"></script>
{ % endjavascripts % }
{% endhighlight %}

Thus, you can take advantage of standard translations for widgets, like the calendar for instance: 

<p class="screenshot">
<img style="width: 30%" src="/images/posts/screen_calendarfr.png" />
</p>