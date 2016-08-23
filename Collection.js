var _ = require('lodash');
var upperCamelCase = require('uppercamelcase');
var async = require('async');
var uuid = require('node-uuid')
var couchbase = require('couchbase');
var compareOpts = require('./comparisonOperation.json');

var MATH_OPERATION = ['average', 'sum'];

var Collection = module.exports = function Collection(definition, ottoman) {

  var self = this;

  // checkIndices is required to be call before searching
  self.checkIndices = false;

  // Set an identity for this collection
  this.identity = definition.identity;
  this.collection = definition.adapter.collection;
  this.connection = ottoman;
  this.definition = definition.definition;

  // build schema out of waterline definition
  this.definition = this._parseDefinition(definition);

  // build indices for searching and querying
  this.indices    = this._buildIndices(this.definition);

  // create a full model object for ottoman to perform CRUD
  // reference
  // https://github.com/couchbaselabs/node-ottoman#model-references
  this.model      = this._buildModel(this.definition, this.indices, ottoman);

  this.isEnsureIndices = false;

  return this;
}

Collection.prototype._buildIndices = function (definition) {

  if (!definition) throw Error('Invalid Definition');

  var index = {};
  _.each(definition, function(value, key){
    index['findBy' + upperCamelCase(key)] = {
      by : key,
      type : 'view'
    }
  });

  return index || {};
}

Collection.prototype._parseDefinition = function _parseDefinition(definition) {
  var model = {};
  _.each(definition.definition, function(value, key){
    _.each(value, function(nestedValue, nestedKey){
      // chnage nested key to fit ottoman
      if (nestedKey === 'defaultsTo') {
        value['default'] = nestedValue;
      }
      if (nestedKey == 'model') {
        value['type'] = 'string'
      }

      // normalize data type
      if (nestedValue === 'datetime' || nestedValue == 'date') {
        value['type'] = 'Date';
      }
      if (nestedValue === 'binary') {
        value['type'] = 'string';
      }
      if (nestedValue === 'float') {
        value['type'] = 'number';
      }
      if (nestedValue === 'json') {
        value['type'] = 'Mixed';
      }
      // default value to string array
      if (nestedValue === 'array') {
        value = ['string'];
      }
    })

    if (key !== 'id')
      model[key] = value;

  })

  return model;
}

Collection.prototype._buildModel = function (definition, indices, ottoman) {
  return ottoman.model(this.collection, definition, {index : indices});
}

Collection.prototype._ensureIndices = function (cb) {

  var self = this;
  if (self.isEnsureIndices) {
    cb(null, true);
    return;
  };

  // this.connection prefer to ottoman set in constructor
  this.connection.ensureIndices(function(err) {
    if (err) {
      console.error(err)
      cb(err);
    };
    self.isEnsureIndices = true;
    cb(null, true);
  });
}

Collection.prototype.find = function(query, cb) {
  console.log("query", query)
  var self = this;
  var options = {};

  var criteria = {};

  if (_.size(query.where) && query.where)
    criteria = query.where;

  criteria = self.deNormalizeId(criteria);

  if (_.size(criteria)) {
    _.each(criteria, function(v){
      if (_.isObject(v) && v['contains'] !== undefined) {
        v['$contains'] = v['contains'];
        delete v['contains'];
      }
      if (_.isObject(v) && v['startsWith'] !== undefined) {
        v['$startsWith'] = v['startsWith'];
        delete v['startsWith'];
      }
      if (_.isObject(v) && v['endsWith'] !== undefined) {
        v['$endsWith'] = v['endsWith'];
        delete v['endsWith'];
      }
      if (_.isObject(v) && v['like'] !== undefined) {
        v['$like'] = v['like'];
        delete v['like'];
      }
      if (_.isObject(v) && v['like'] !== undefined) {
        v['$like'] = v['like'];
        delete v['like'];
      }

      _.each(compareOpts, function(mathSign, englishSign){
        if (_.isObject(v) && v[englishSign] !== undefined) {
          var holdValue = v[englishSign];
          delete v[englishSign];
          v[mathSign] = holdValue;
        }
      })
    })
  }

  // -------- check querying object ----
  var sort = query.sort || {};
  if (!_.isEmpty(sort)) options.sort = sort;
  if (!!query.ignoreCase) options.ignoreCase = query.ignoreCase;
  if (!!query.groupBy) options.groupBy = query.groupBy;
  if (!!query.limit) options.limit = query.limit;
  if (!!query.skip) options.skip = query.skip;
  if (!!query.select) options.select = query.select;
  if (!!options.select && !_.includes(options.select, '_id')) options.select.push('_id');


  //
  // arithmetic operation
  //
  if (!!query.average) options.average = query.average;
  if (!!query.max) options.max = query.max;
  if (!!query.min) options.min = query.min;
  if (!!query.sum) options.sum = query.sum;
  if (query.groupBy && (!query.sum && !query.average)) {
    cb(new Error('groupBy need to associate with an operation!'))
    return;
  }

  //////////////////////////////////////////////////

  // ensure data persistant
  options.consistency = self.connection.Consistency.LOCAL;

  var doc = self.model.find(criteria, options, function (err, mDoc){
    if (err) {
      throw new Error(err);
    }

    if (_.isArray(mDoc)) _.map(mDoc, function(doc) {return self.normalizeId(doc)});
    else mDoc = self.normalizeId(mDoc);

    cb(null, mDoc);
  })

}

Collection.prototype.create = function (values, cb) {
  console.log('values', values)
  var self = this;

  // this need to be revisit, not sure if generating id this way is good
  values._id = uuid.v4().replace(/-/g, "");

  var newDocument = new self.model(values);

  newDocument.save(function(err) {

    if (err) {
      console.error(err);
      cb(err);
    }

    newDocument = self.normalizeId(values);

    cb(null, newDocument)
  });
}

Collection.prototype.destroy = function (values, cb) {
  var self = this;

  this.find(values, function(err, result){
    if (err) {
      console.error(err);
      cb(err);
    }

    if (_.isEmpty(result)) cb(null, []);
    else {
      if (_.isArray(result) && _.size(result)) {

        // remove all record that was found
        async.map(result, function(rel, cbRemove){

          rel = self.deNormalizeId(rel);
          rel.remove(function(err){
            if (err) {
              cbRemove(err);
            }

            rel = self.normalizeId(rel);
            cbRemove(null, rel);

          })} ,  // end remove
          function(finalErr, removeResult){

            if (err) cb(finalErr)
            cb(null, removeResult);
          })
      }
      else {
        result = self.deNormalizeId(result);
        result.remove(function(err, result){
          if (err) cb(err)
          result = self.normalizeId(result);
          cb(null, result);
        })
      }
    }
  })

}

Collection.prototype.update = function (option, values, cb) {
  var self = this;

  this.find(option, function(err, result){
    if (err) {
      console.error(err);
      cb(err);
    }

    if (_.isArray(result)) {

      // remove all record that was found
      async.map(result, function(rel, cbUpdate){

        // overriding value for update
        _.each(values, function(v,k) {
          if (typeof rel[k] !== undefined) rel[k] = v;
        })

        rel = self.deNormalizeId(rel);
        rel.save(function(err){
          if (err) {
            cbUpdate(err);
          }

          rel = self.normalizeId(rel);
          cbUpdate(null, rel);

        })} ,  // end remove
        function(finalErr, updateResult){
          if (err) cb(finalErr)
          cb(null, updateResult);
        })
    }
    else {

      _.each(values, function(v,k) {
        if (!!result[k]) result[k] = v;
      });

      result = self.deNormalizeId(result);

      result.save(function(err, result){
        if (err) cb(err)
        result = self.normalizeId(result);
        cb(null, result);
      })
    }
  })
}

Collection.prototype.deNormalizeId = function(obj) {
  if ( !!obj.id ) obj._id = obj.id;
  delete obj.id;
  return obj;
}

Collection.prototype.normalizeId = function(obj) {
  if ( !!obj._id ) obj.id = obj._id;
  delete obj._id;
  return obj;
}

Collection.prototype.drop = function (collectionName, bucketName, cb) {

  var N1qlQuery = couchbase.N1qlQuery;

  var query = N1qlQuery.fromString('DELETE FROM ' + bucketName + ' WHERE _type=' + '"' + collectionName + '"');

  this.connection.bucket.query(query, function(err, result) {
    if (err) cb(err);
    else cb(null, result);
  })

}
