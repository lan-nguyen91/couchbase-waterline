var connections = {};
var collections = {};
var dbs = {};
var ottoman = require('ottoman');
var couchbase = require('couchbase');

exports.connect = function (opts) {
  var cluster = new couchbase.Cluster('couchbase://127.0.0.1');
  var bucket = cluster.openBucket('default');
  return bucket;
}

/// connections
exports.connection = connection;

function connection(name, connection) {
  if (! connection) return getConnection(name);
  else return setConnection(name, connection);
}

function setConnection(name, connection) {
  connections[name] = connection;
}

function getConnection(name) {
  return connections[name];
}

/// collection

exports.collection = collection;

function collection(name, collection) {
  if (! collection) return getCollection(name);
  else return setCollection(name, collection);
}

function setCollection(name, collection) {
  collections[name] = collection;
}

function getCollection(name) {
  return collections[name];
}


/// dbs

exports.db = db;

function db(name, db) {
  if (! db) return getDb(name);
  else return setDb(name, db);
}

function setDb(name, db) {
  dbs[name] = db;
}

function getDb(name) {
  return dbs[name];
}
