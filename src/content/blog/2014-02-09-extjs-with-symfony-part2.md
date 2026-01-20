---
title: 'Use Sencha ExtJS with Symfony 2, The Proxy'
description: 'How to use Sencha ExtJS with Symfony 2, The Proxy'
pubDate: '2014-02-09'
conclusion: '💃 Happy Coding!'
---

In the [previous article](../2014-02-04-extjs-with-symfony-part1) we explored how to include an ExtJS application inside of Symfony 2.
We started with the model and the view. Now we're going to see the controller and how to retrieve messages.

## Ajax proxy

A proxy allows to define the remote source and the format of the results.
AjaxProxy uses ajax requests to load data from the server. As a reminder, here's how we setted it up:

```json
...
    proxy: {
        type: 'ajax',
        url: '/message/list',
        reader: {
            type: 'json',
            root: 'results',
            totalProperty: 'totalCount',
            successProperty: 'success'
        }
    },
...
```

Now we create the controller on the server side. The routing must match with the url called by the proxy.

```php
<?php
namespace Sencha\TicketBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;

use Sencha\TicketBundle\Model\MessageQuery;

class MessageController extends Controller
{
    /**
     * @Route("/message/list", name="_message_list", defaults={"_format": "json"})
     */
    public function listAction()
    {
        $listMessages = array();
        $total = 0;
        $success = true;
        $error = "";

        $request = $this->get('request');
        try {
            $messages = MessageQuery::create()->paginateGrid($request->query);

            foreach ($messages as $message) {
                $listMessages[] = $message->toArray();
            }

            $total = $messages->getNbResults();
        } catch (\Exception $e) {
            $success = false;
            $error = $e->getMessage();
        }

        return new Response(json_encode(array(
            'success'    => (bool) $success,
            'totalCount' => (int) $total,
            'results'    => $listMessages,
            'error'      => $error
        )));
    }

}
```

Thanks to the Propel behavior [Senchagridable](https://github.com/heristop/SenchagridableBehavior/), there is nothing more to add.
You can filter, sort and paginate the messages only with the query method `paginateGrid`. Then you should return the results in JSON:

```json
{
   "success":true,
   "totalCount":1,
   "results":[
        {
            "Id":1,
            "Subject":"Corrupti sequi consectetur vitae rerum.",
            ...
            "CreationDate":1391722508,
            "ModificationDate":1391722508,
            "Priority":"normal"
        }
   ],
   "error":""
}
```

The routing paramater `_format` allows to send the right Content-Type of the Response.

## JsonP proxy

AjaxProxy cannot be used to retrieve data from other domains, because cross-domain ajax requests are prohibited by the browser.
JsonP proxy allows this cross domain. It formats the url, adding the callback parameter automatically.
Ergo, it looks like you loaded it through a normal AjaxProxy. Here is an example of set up:

```json
...
    proxy: {
        type: 'jsonp',
        url: 'http://other-ticket-system/service/api/ticket/list',
        reader: {
            root: 'results',
            totalProperty: 'totalCount',
            successProperty: 'success'
        }
    }
...
```

The server should return a javascript with the callback function:

```js
Ext.data.JsonP.callback7({
    "success":true,
    "totalCount":1,
    "results":[
        {
            "Id":1,
            "Subject":"Corrupti sequi consectetur vitae rerum.",
            ...
            "CreationDate":1391722508,
            "ModificationDate":1391722508,
            "Priority":"normal"
        }
    ],
    "error":""
});
```

## Conclusion

At this point you have a lovely grid with data, but maybe you want to see more.
For completeness, a concrete example can be found here: [HeriTicketManager](https://github.com/heristop/HeriTicketManager/).

The grid looks like this:

![screenshot](/images/posts/screen_list.webp)

And here's a view sample to display the detail of a ticket:

![screenshot](/images/posts/screen_show.webp)
