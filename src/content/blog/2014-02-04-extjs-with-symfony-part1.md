---
title: "Use Sencha ExtJS with Symfony 2, The Viewport"
description: "How to use Sencha ExtJS with Symfony 2, The Viewport"
pubDate: "2014-02-04"
---

Sencha ExtJS is a javascript framework which allows to create some RIA (Rich Internet Application).
In this tutorial, I propose to develop a mini ticket manager in which we could list, create, edit and delete some tickets.

On customer side, the project will introduce :

> The viewport build
>
> The use of proxy for AJAX or cross domain requests

The server side will use Symfony 2 and Propel.

First, download Symfony 2.4.

## Configuration

To install Propel add the line below on the composer file configuration.
By the way, we also include a behavior which will be used to automatically sort and filter grids.

```json
"require": {
    ...
    "propel/propel-bundle": "1.4.*",
    "heristop/propel-senchagridable-behavior": "1.0.*"
    ...
},
```

By default, Symfony copy the assets on the web directory. This could take time regarding the size of ExtJS library.
Therefore, we use symblink in the extra section:

```json
"extra": {
    ...
    "symfony-assets-install": "symlink",
    ...
}
```

Then, let's take a look on the Propel configuration. We choose to use the ExtJS date formatter instead of Propel formatter.
To deactivate it, add this lines in `config.yml`:

```yaml
# Propel Configuration
propel:
  build_properties:
    propel.useDateTimeClass: false
```

Finally, create a bundle. In our example, the name of the bundle is `SenchaTicketBundle`.

```sh
app/console generate:bundle --namespace=Sencha/TicketBundle
```

## Modele

Our mini ticketing system requires to store users, messages and responses.
For now, we setup the message table only:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<database name="default" namespace="Sencha\TicketBundle\Model" defaultIdMethod="native">

    <table name="message" phpName="Message" idMethod="native">
        <column name="id" phpName="Id" type="INTEGER" primaryKey="true" autoIncrement="true" required="true"/>
        <column name="username" phpName="Username" type="VARCHAR" size="32" required="true"/>
        <column name="subject" phpName="Subject" type="VARCHAR" size="64" required="true"/>
        <column name="email" phpName="Email" type="VARCHAR" size="32" required="false"/>
        <column name="phone" phpName="Phone" type="VARCHAR" size="32" required="false"/>
        <column name="header_mail" phpName="HeaderMail" type="LONGVARCHAR" required="false"/>
        <column name="body" phpName="Body" type="LONGVARCHAR" required="false"/>
        <column name="ip_address" phpName="IpAddress" type="VARCHAR" size="16" required="false"/>
        <column name="status" phpName="Status" type="VARCHAR" size="16" required="false"/>
        <column name="priority" phpName="Priority" type="VARCHAR" size="16" required="false"/>
        <column name="source" phpName="Source" type="VARCHAR" size="16" required="false"/>
        <column name="overdue_date" phpName="OverdueDate" type="TIMESTAMP" required="false"/>
        <column name="last_response_date" phpName="LastResponseDate" type="TIMESTAMP" required="false"/>
        <column name="creation_date" phpName="CreationDate" type="TIMESTAMP" required="false"/>
        <column name="modification_date" phpName="ModificationDate" type="TIMESTAMP" required="false"/>
        <behavior name="timestampable">
            <parameter name="create_column" value="creation_date" />
            <parameter name="update_column" value="modification_date" />
        </behavior>
        <behavior name="senchagridable" />
        <index name="status_idx">
            <index-column name="status"/>
        </index>
        <index name="priority_idx">
            <index-column name="priority"/>
        </index>
        <index name="subject_idx">
            <index-column name="subject"/>
        </index>
        <index name="email_idx">
            <index-column name="email"/>
        </index>
    </table>

</database>
```

You can create some fixtures too. Have some records to display in the grid is nicer!

```yaml
Sencha\TicketBundle\Model\Message:
    Message_1:
        username: anonymous
        subject: 'Lorem ipsum dolor sit amet'
        email: anonymous@test.com
        body: 'Phasellus consequat nisl at vehicula adipiscing. Pellentesque...'
        status: 'opened'
        source: normal
        source: web
    Message_2:
        username: anonymous
        subject: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'
        email: anonymous@test.com
        body: 'Donec convallis mattis nisi tincidunt elementum...'
        status: 'opened'
        source: normal
        source: web
    ...
```

Finally, run this commands to build the database structure:

```sh
app/console propel:model:build
app/console propel:sql:build
app/console propel:sql:insert —force
app/console propel:fixtures:load
```

## Frontend

For the client side, we need to download the ExtJS 4.2 and copy it in `Resources/public/ext`.
Then we are going to create the MVC structure for the application in `Resources/public/js`:

```sh
public
 └─ css
 └─ ext                       # ExtJS library
 └─ images
 └─ js
     └─ app                   # ExtJS application
         └─ model
             └─ Message.js
         └─ store
             └─ Messages.js
         └─ view
             └─ message
                 └─ List.js
                 └─ Show.js
         └─ app.js
```

**Note:** If the symbolic links are not created yet, run this command:

```sh
app/console assets:install --symlink
```

### Assetic

The Assetic library will allow us to combine and include all files of the application, matching with the tree structure.
Activate it for the bundle in `config.yml`:

```yaml
# app/config/config.yml
assetic:
  debug: "%kernel.debug%"
  use_controller: false
  bundles: [SenchaTicketBundle]
```

### Template

On the template we will use the combining option of Assetic to include the javascripts.
Don't forget to include ExtJS too, otherwise you are going to have a blank page! In the example, I picked the Neptune theme:

```html
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Ticket Middle Office</title>
    <link
      rel="stylesheet"
      type="text/css"
      href="{ { asset('bundles/senchaticket/ext/resources/ext-theme-neptune/ext-theme-neptune-all.css') } }"
    />
    <script
      type="text/javascript"
      src="{ { asset('bundles/senchaticket/ext/ext-all.js') } } "
    ></script>
    <script
      type="text/javascript"
      src="{ { asset('bundles/senchaticket/ext/ext-theme-neptune.js') } } "
    ></script>
    { % javascripts '@SenchaTicketBundle/Resources/public/js/app/model/*'
    '@SenchaTicketBundle/Resources/public/js/app/store/*'
    '@SenchaTicketBundle/Resources/public/js/app/view/*'
    '@SenchaTicketBundle/Resources/public/js/app/view/*/*'
    '@SenchaTicketBundle/Resources/public/js/app/controller/*'
    '@SenchaTicketBundle/Resources/public/js/app/*' % }
    <script src="{ { asset_url } }"></script>
    { % endjavascripts % }
  </head>
  <body>
    <!-- No html body. No layout. Welcome in ExtJS world! -->
  </body>
</html>
```

**Note:** On production environment, you need to run this command to combine the assets:

```sh
app/console assetic:dump
```

You can also use the YUI compressor to optimize and minify your code. See how to configure it here: [YUI Filters](http://symfony.com/doc/current/cookbook/assetic/yuicompressor.html#configure-the-yui-filters).

### Viewport

Our viewport contains a main panel and a grid where we will display the tickets list.
This tutorial remains simple, but feel free to design the viewport as you like, adding a menu or a header for instance.

Here's the main entrance of our application: `app.js`.

```js
// Resources/public/js/app/app.js
Ext.Loader.setConfig({
  // disable ExtJS autoload
  enabled: false,
});

Ext.application({
  name: "Ticket",

  appFolder: "app",

  controllers: ["Messages"],

  appFolder: "app",

  launch: function () {
    Ext.tip.QuickTipManager.init();

    Ext.create("Ext.container.Viewport", {
      border: false,
      layout: {
        type: "border",
      },
      items: [
        {
          border: false,
          region: "center",
          layout: {
            type: "border",
          },
          items: [
            {
              id: "content-panel",
              border: false,
              region: "center",
              layout: {
                type: "card",
              },
              margins: "2 5 5 0",
              items: [
                {
                  // here we will display the grid!
                  xtype: "messagelist",
                  region: "center",
                  title: "Tickets List",
                  id: "ticket-grid",
                },
              ],
            },
          ],
        },
      ],
    });
  },
});
```

### Model

Then in the model, we define the structure of a message:

```js
// Resources/public/js/app/model/Message.js
Ext.define("Ticket.model.Message", {
  extend: "Ext.data.Model",
  fields: [
    {
      name: "Id",
      type: "int",
    },
    {
      name: "Subject",
      type: "string",
    },
    {
      name: "Email",
      type: "string",
    },
    {
      name: "Status",
      type: "string",
    },
    {
      name: "Priority",
      type: "string",
    },
    {
      name: "Source",
      type: "string",
    },
    {
      name: "OverdueDate",
      type: "date",
      dateFormat: "timestamp",
    },
    {
      name: "CreationDate",
      type: "date",
      dateFormat: "timestamp",
    },
    {
      name: "ModificationDate",
      type: "date",
      dateFormat: "timestamp",
    },
  ],
});
```

### Store

We have the model, which is close to the definition of record. Therefore, we need to manipulate a collection of records.
The role of the store is to retrieve data via the proxy and apply filters.

```js
// Resources/public/js/app/store/Message.js
Ext.define("Ticket.store.Messages", {
  extend: "Ext.data.Store",

  constructor: function (cfg) {
    var me = this;

    cfg = cfg || {};
    me.callParent([
      Ext.apply(
        {
          autoLoad: true,
          model: "Ticket.model.Message",
          proxy: {
            type: "ajax",
            url: "/message/list",
            reader: {
              type: "json",
              root: "results",
              totalProperty: "totalCount",
              successProperty: "success",
            },
          },
          sorters: [
            {
              property: "CreationDate",
              direction: "DESC",
            },
          ],
          listeners: {
            load: function (records, operation, success) {
              if (false === success) {
                Ext.MessageBox.alert(
                  "Warning",
                  "The server returned an error.",
                );
              }
            },
          },
        },
        cfg,
      ),
    ]);
  },
});
```

### View

The view is a grid where we are going to define the columns we want to display or sort.
It extends the widget `Ext.grid.Panel`:

```js
// Resources/public/js/app/view/message/List.js
Ext.define("Ticket.view.message.List", {
  extend: "Ext.grid.Panel",
  alias: "widget.messagelist",

  initComponent: function () {
    var me = this;

    me.callParent(
      Ext.applyIf(me, {
        store: "Messages",
        border: false,
        forceFit: true,
        columns: [
          {
            xtype: "gridcolumn",
            dataIndex: "Id",
            text: "Ticket Id",
            filterable: true,
            hidden: true,
          },
          {
            xtype: "gridcolumn",
            dataIndex: "Subject",
            text: "Subject",
            filterable: true,
          },
          {
            xtype: "gridcolumn",
            dataIndex: "Email",
            text: "Email",
            filterable: true,
          },
          {
            xtype: "gridcolumn",
            dataIndex: "Status",
            text: "Status",
            filterable: true,
            filter: {
              type: "list",
              options: ["opened", "assigned", "closed"],
              phpMode: true,
            },
          },
          {
            xtype: "gridcolumn",
            dataIndex: "Priority",
            text: "Priority",
            filterable: true,
            searchable: false,
            filter: {
              type: "list",
              options: ["low", "normal", "high", "emergency"],
              phpMode: true,
            },
          },
          {
            xtype: "gridcolumn",
            dataIndex: "Source",
            text: "Source",
            filterable: true,
            searchable: false,
            filter: {
              type: "list",
              options: ["web", "email", "phone", "other"],
              phpMode: true,
            },
          },
          {
            xtype: "datecolumn",
            dataIndex: "OverdueDate",
            text: "Due date",
            format: "d/m/Y",
            filterable: true,
            searchable: false,
          },
          {
            xtype: "datecolumn",
            dataIndex: "CreationDate",
            text: "Date creation",
            format: "d/m/Y H:i:s",
            filterable: true,
            searchable: false,
          },
          {
            xtype: "datecolumn",
            dataIndex: "ModificationDate",
            text: "Date modification",
            hidden: true,
            format: "d/m/Y H:i:s",
            filterable: true,
            searchable: false,
          },
        ],
      }),
    );
  },
});
```

**Protip:** To take advantage of the filter feature, we could have included it like that:

```js
// Resources/public/js/app/app.js
Ext.Loader.setConfig({
  enabled: true,
  paths: {
    "Ext.ux": "/bundles/senchaticket/ext/examples/ux",
  },
});

Ext.require(["Ext.ux.grid.FiltersFeature"]);
```

But using the ExtJS loader function make loose the benefit of asset combining on the production environment.
Indeed ExtJS will make many HTTP requests to get all required files.
So prefer to include what you need on the template, and be careful to respect the order of inclusion:

```html
{ % stylesheets '@HeriTicketBundle/Resources/public/ext/examples/ux/grid/css/*'
'@HeriTicketBundle/Resources/public/css/*' % }
<link
  rel="stylesheet"
  type="text/css"
  media="screen"
  href="{ { asset_url } }"
/>
{ % endstylesheets % } { % javascripts
'@SenchaTicketBundle/Resources/public/ext/examples/ux/grid/menu/*'
'@SenchaTicketBundle/Resources/public/ext/examples/ux/grid/filter/Filter.js'
'@SenchaTicketBundle/Resources/public/ext/examples/ux/grid/filter/*'
'@SenchaTicketBundle/Resources/public/ext/examples/ux/grid/FiltersFeature.js'
... % }
<script src="{ { asset_url } }"></script>
{ % endjavascripts % }
```

Now we have a great filters feature on our grid!

![screenshot](/images/posts/screen_filter.png)

### Controller

We finish with one of the most important part: the controller.
The controller allows views, stores and models to link to each other:

```js
// Resources/public/js/app/controller/Messages.js
Ext.define("Ticket.controller.Messages", {
  extend: "Ext.app.Controller",

  models: ["Message"],

  stores: ["Messages"],

  views: [
    "message.List",
    // and other views later like 'message.Show'
  ],

  init: function () {
    var me = this;

    me.control({
      messagelist: {
        select: me.handleSelectMessage,
      },
    });
  },

  handleSelectMessage: function (that, record, index, e) {
    console.log(record);
  },
});
```

We can also write the listeners to apply on the widgets.
In the above example, we display the selected record on the browser console. Useless? Not for debug!
And with the event programming it is essential.

## Conclusion

In this article we have looked at the basic configuration and created a skeleton for our application.
In the next part we will implement our controller action and retrieve the messages from the database.
