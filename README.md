[![](https://camo.githubusercontent.com/9e49073459ed4e0e2687b80eaf515d87b0da4a6b/687474703a2f2f62616c64657264617368792e6769746875622e696f2f7361696c732f696d616765732f6c6f676f2e706e67)](http://sailsjs.org/#!)

# sails-couchbase

Waterline adapter for CouchBase

> **Heads up**
>
> `sails-couchbase` maps the logical `id` attribute to the required `_id` physical-layer couchbase id.
> In the current version of `sails-couchbase`.

## Installation

Install from NPM.

```bash
$ npm install sails-couchbase --save
```

## Sails Configuration

### Using with Sails v0.11.x (>= 0.10.x)

Add the following config to the `config/connections.js` file:

```javascript
module.exports.connections = {

  couchbaseDb: {
    adapter: 'sails-couchbase',
    host: 'localhost', // defaults to `localhost` if omitted
    port: 8091, // defaults to 27017 if omitted
    bucket: 'bucket_name', // or omit if not relevant
    password: 'password_here' // or omit if not relevant
  }
};
```

And set this particular couchbase database as your default in `config/models.js`:

```js
module.exports.models = {
  'connection': 'couchbaseDb'
};
```


### Legacy usage

####Using with Sails v0.9.x

Add the mongo config to the `config/adapters.js` file.

```javascript
module.exports.adapters = {
  'default': 'couchbase',

  couchbase: {
    module: 'sails-couchbase',
    host: 'localhost',
    port: 27017,
    bucket : 'bucket'
    password: 'password'
  }
};
```

Don't forget that couchbase required id as a string .

## Sails.js

http://sailsjs.org

## Waterline

[Waterline](https://github.com/balderdashy/waterline) is a brand new kind of storage and retrieval engine.

It provides a uniform API for accessing stuff from different kinds of databases, protocols, and 3rd party APIs. That means you write the same code to get users, whether they live in MySQL, LDAP, MongoDB, or Facebook.


## Sails.js License

### The MIT License (MIT)

Copyright © 2012-2015 Mike McNeil &amp; contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
