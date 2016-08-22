/**
 * Module Dependencies
 */
// ...
// e.g.
// var _ = require('lodash');
// var mysql = require('node-mysql');
// ...
var async     = require('async');
var _         = require('lodash');
var Connection   = require('./Connection');
var Collection   = require('./Collection');
var util = require('util');
var uuid = require('node-uuid');

var couchbase = require('couchbase');

function sanitizeCollectionName (collectionName) {
  return collectionName.replace(/([A-Z])/g, function (c) {
    return c.toLowerCase();
  });
}

module.exports = (function () {


  // You'll want to maintain a reference to each collection
  // (aka model) that gets registered with this adapter.
  var _modelReferences = {};

  var _dbPools = {};
  var connections = {};

  var adapter = {

    syncable: false,


    defaults: {

      // For example:
      port: 8091,
      host: 'localhost',
      bucket : 'default',

    },


    registerConnection : function (connection, collections, cb) {
      if(!connection.identity) return cb(Errors.IdentityMissing);
        if(connections[connection.identity]) return cb(Errors.IdentityDuplicate);

      connection = _.defaults(connection , this.defaults);

      connections[connection.identity] = {
        config: connection,
        collections: {},
        bucket : connection.bucket
      };

      // Create a new active connection
      new Connection(connection, function(_err, connectionCb) {

        if(_err) {
          return cb((function _createError(){
            var msg = util.format('Failed to connect to CouchBase.  Are you sure your configured CouchBase instance is running?\n Error details:\n%s', util.inspect(_err, false, null));
            var err = new Error(msg);
            err.originalError = _err;
            return err;
          })());
        }

        connections[connection.identity].connection = connectionCb.ottoman;

        // Build up a registry of collections
        Object.keys(collections).forEach(function(key) {
          var existed = false;

          // ensure that if the collection is already exist then use it
          // and a collection identity is unique
          _.each(connections[connection.identity].collections, function(value){
            if (value.identity == collections[key].identity) {
              connections[connection.identity].collections[key] = value;
              existed = true;
            }
          })

          if (!existed)
            connections[connection.identity].collections[key] = new Collection(collections[key], connectionCb.ottoman);
        });

        connectionCb.ottoman.ensureIndices(function (err){
          if (err) throw new Error(err);
          cb();
        })
      });
    },

    /**
     *
     * This method runs when a model is initially registered
     * at server-start-time.  This is the only required method.
     *
     * @param  {[type]}   collection [description]
     * @param  {Function} cb         [description]
     * @return {[type]}              [description]
     */
    registerCollection: function(connection, collections, cb) {
      if(!connection.identity) return cb(Errors.IdentityMissing);
      if(connections[connection.identity]) return cb(Errors.IdentityDuplicate);

      // Merging default options
      connection = _.defaults(connection, this.defaults);

      // Store the connection
      connections[connection.identity] = {
        config: connection,
        collections: {}
      };

      // Create a new active connection
      new Connection(connection, function(_err, db) {

        if(_err) {
          return cb((function _createError(){
            var msg = util.format('Failed to connect to MongoDB.  Are you sure your configured Mongo instance is running?\n Error details:\n%s', util.inspect(_err, false, null));
            var err = new Error(msg);
            err.originalError = _err;
            return err;
          })());
        }
        connections[connection.identity].connection = db;

        // Build up a registry of collections
        Object.keys(collections).forEach(function(key) {
          connections[connection.identity].collections[key] = new Collection(collections[key], db);
        });

        cb();
      });
    },


    /**
     * Fired when a model is unregistered, typically when the server
     * is killed. Useful for tearing-down remaining open connections,
     * etc.
     *
     * @param  {Function} cb [description]
     * @return {[type]}      [description]
     */
    teardown: function(connection, cb) {
      delete connections[connection];
      cb(null, true);
    },



    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   definition     [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    define: function(collectionName, definition, cb) {
      cb();
    },

    /**
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     * @param  {[type]}   collectionName [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    describe: function(connectionName, collectionName, cb) {

      var connectionObject = connections[connectionName];
      var collection = connectionObject.collections[collectionName];
      if (collection)
        return cb(null, collection.model);
      else
        return cb(new Error('No Collection Found'));
    },


    /**
     *
     *
     * REQUIRED method if integrating with a schemaful
     * (SQL-ish) database.
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   relations      [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    drop: function(connectionName, collectionName, relations, cb) {
      if (!connections[connectionName])
        cb(new Error("Failed To LookUp Connection"));
      if (!connections[connectionName].collections[collectionName])
        cb(new Error("Failed To LookUp Connection"));

      var collection = connections[connectionName].collections[collectionName];
      var bucketName = connections[connectionName].bucket;

      collection.drop(collectionName, bucketName, cb)
    },




    // OVERRIDES NOT CURRENTLY FULLY SUPPORTED FOR:
    //
    // alter: function (collectionName, changes, cb) {},
    // addAttribute: function(collectionName, attrName, attrDef, cb) {},
    // removeAttribute: function(collectionName, attrName, attrDef, cb) {},
    // alterAttribute: function(collectionName, attrName, attrDef, cb) {},
    // addIndex: function(indexName, options, cb) {},
    // removeIndex: function(indexName, options, cb) {},



    /**
     *
     * REQUIRED method if users expect to call Model.find(), Model.findOne(),
     * or related.
     *
     * You should implement this method to respond with an array of instances.
     * Waterline core will take care of supporting all the other different
     * find methods/usages.
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    find: function(connectionName, collectionName, options, cb) {

      if (!connections[connectionName])
        cb(new Error("Failed To LookUp Connection"));
      if (!connections[connectionName].collections[collectionName])
        cb(new Error("Failed To LookUp Connection"));

      var collection = connections[connectionName].collections[collectionName];

      collection.find(options, cb);
    },

    /**
     *
     * REQUIRED method if users expect to call Model.create() or any methods
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   values         [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    create: function(connectionName, collectionName, values, cb) {
      if (!connections[connectionName]) {
        throw new Error("Failed To LookUp Connection");
      }
      if (!connections[connectionName].collections[collectionName]) {
        throw new Error("Failed To LookUp Connection");
      }

      var collection = connections[connectionName].collections[collectionName];

      collection.create(values, cb);
    },



    //

    /**
     *
     *
     * REQUIRED method if users expect to call Model.update()
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {[type]}   values         [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    update: function(connectionName, collectionName, options, values, cb) {

      if (!connections[connectionName]) {
        throw new Error("Failed To LookUp Connection");
      }
      if (!connections[connectionName].collections[collectionName]) {
        throw new Error("Failed To LookUp Connection");
      }

      var collection = connections[connectionName].collections[collectionName];

      collection.update(options, values, cb);
    },

    /**
     *
     * REQUIRED method if users expect to call Model.destroy()
     *
     * @param  {[type]}   collectionName [description]
     * @param  {[type]}   options        [description]
     * @param  {Function} cb             [description]
     * @return {[type]}                  [description]
     */
    destroy: function(connectionName, collectionName, options, cb) {
      if (!connections[connectionName]) {
        throw new Error("Failed To LookUp Connection");
      }
      if (!connections[connectionName].collections[collectionName]) {
        throw new Error("Failed To LookUp Connection");
      }

      var collection = connections[connectionName].collections[collectionName];

      collection.destroy(options, cb);
    },

    /*
    **********************************************
    * Optional overrides
    **********************************************

    // Optional override of built-in batch create logic for increased efficiency
    // (since most databases include optimizations for pooled queries, at least intra-connection)
    // otherwise, Waterline core uses create()
    createEach: function (collectionName, arrayOfObjects, cb) { cb(); },

    // Optional override of built-in findOrCreate logic for increased efficiency
    // (since most databases include optimizations for pooled queries, at least intra-connection)
    // otherwise, uses find() and create()
    findOrCreate: function (collectionName, arrayOfAttributeNamesWeCareAbout, newAttributesObj, cb) { cb(); },
    */


    /*
    **********************************************
    * Custom methods
    **********************************************

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // > NOTE:  There are a few gotchas here you should be aware of.
    //
    //    + The collectionName argument is always prepended as the first argument.
    //      This is so you can know which model is requesting the adapter.
    //
    //    + All adapter functions are asynchronous, even the completely custom ones,
    //      and they must always include a callback as the final argument.
    //      The first argument of callbacks is always an error object.
    //      For core CRUD methods, Waterline will add support for .done()/promise usage.
    //
    //    + The function signature for all CUSTOM adapter methods below must be:
    //      `function (collectionName, options, cb) { ... }`
    //
    ////////////////////////////////////////////////////////////////////////////////////////////////////


    // Custom methods defined here will be available on all models
    // which are hooked up to this adapter:
    //
    // e.g.:
    //
    foo: function (collectionName, options, cb) {
      return cb(null,"ok");
    },
    bar: function (collectionName, options, cb) {
      if (!options.jello) return cb("Failure!");
      else return cb();
    }

    // So if you have three models:
    // Tiger, Sparrow, and User
    // 2 of which (Tiger and Sparrow) implement this custom adapter,
    // then you'll be able to access:
    //
    // Tiger.foo(...)
    // Tiger.bar(...)
    // Sparrow.foo(...)
    // Sparrow.bar(...)


    // Example success usage:
    //
    // (notice how the first argument goes away:)
    Tiger.foo({}, function (err, result) {
      if (err) return console.error(err);
      else console.log(result);

      // outputs: ok
    });

    // Example error usage:
    //
    // (notice how the first argument goes away:)
    Sparrow.bar({test: 'yes'}, function (err, result){
      if (err) console.error(err);
      else console.log(result);

      // outputs: Failure!
    })




    */


  };


  // Expose adapter definition
  return adapter;

})();

