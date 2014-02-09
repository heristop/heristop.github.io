---
layout: post
title:  "Use Sencha ExtJS with Symfony 2, The Forms"
---

### RESTFul example

{% highlight php %}
<?php
namespace Sencha\TicketBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;

class MessageController extends Controller
{
    ...

    /**
     * @Route("/message/create", name="_message_create")
     */
    public function createAction() {
        
        $parameters = $this->get('request')->request->all();
        $attachment = $this->get('request')->files->get('attachment');
        
        if ($attachment) {
            $parameters = array_merge(
                $parameters,
                // php 5.5
                //array('file' => new \CURLFile(
                //    $attachment->getPathname(),
                //    $attachment->getMimeType(),
                //    $attachment->getClientOriginalName()
                //))
                
                // php 5.3
                array(
                    'file' =>
                        "@".$attachment->getPathname().
                        ";filename=".$attachment->getClientOriginalName().
                        ";type=".$attachment->getMimeType(),
                    'filename' => $attachment->getClientOriginalName(),
                    'mimetype' => $attachment->getMimeType(),
                    'filesize' => $attachment->getClientSize()
                )
            );
        }
        
        $response = new Response($this->post(
            $this->container->getParameter('other-ticket-system.url').'/service/api/ticket/create',
            $parameters
        ));
        
        $response->setStatusCode(200);
        $response->headers->set('Content-Type', 'application/json');
        
        return $response;
    }
    
    ...
    
    /**
     * Send a POST request using cURL
     * @param string $url to request
     * @param array $post values to send
     * @param array $options for cURL
     * @return string
     */
    protected function post($url, array $post = null, array $options = array())
    {
        $defaults = array(
            CURLOPT_POST           => 1,
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_TIMEOUT        => 4,
            CURLOPT_POSTFIELDS     => $post
        );
        
        $ch = curl_init();
        curl_setopt_array($ch, ($options + $defaults));
        if(! $result = curl_exec($ch))
        {
            trigger_error(curl_error($ch));
        }
        curl_close($ch);
        
        return $result;
    }
    
}
{% endhighlight %}