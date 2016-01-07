var
  async = require('async'),
  q = require('q');

var myHooks = function () {
  /**
   *  API LOADING AND RELEASING
   *  Until cucumber.js supports BeforeAll and AfterAll tags, we have to open/close connections
   *  on each test case.
   *
   *  We could also load all the tested API at the beginning of each test case, using reentrant init() functions,
   *  and close them all at the very end using the AfterFeatures event.
   *  This method involves a cucumber.js hack, where we save a 'world' reference at the end of each test case so that
   *  we can use it when the AfterFeatures event is emitted.
   *
   *  Problem is, there is no guarantee that the world we saved still exists when this event is sent. In fact, the
   *  Cucumber.js documentation states that it should be destroyed at this point of time.
   *
   *  And we don't want to deal with destroyed worlds, this is all too messy. And dangerous.
   */
  this.Before('@usingREST', function (scenario, callback) {
    this.api = setAPI(this, 'REST');
    callback();
  });

  this.Before('@usingWebsocket', function (scenario, callback) {
    this.api = setAPI(this, 'Websocket');
    callback();
  });

  this.Before('@usingMQTT', function (scenario, callback) {
    this.api = setAPI(this, 'MQTT');
    callback();
  });

  this.Before('@usingAMQP', function (scenario, callback) {
    this.api = setAPI(this, 'AMQP');
    callback();
  });

  this.Before('@usingSTOMP', function (scenario, callback) {
    this.api = setAPI(this, 'STOMP');
    callback();
  });


  this.registerHandler('BeforeFeature', (event, callback) => {
    this.api = setAPI(this, 'REST');
    this.api.createIndex((new this.World()).fakeIndex)
      .then(() => {
        return this.api.createIndex((new this.World()).fakeAltIndex);
      })
      .then(() => {
        setTimeout(callback, 1000);
      })
      .catch(error => callback(new Error(error)));
  });

  this.registerHandler('AfterFeature', function (event, callback) {
    this.api = setAPI(this, 'REST');
    this.api.deleteIndexes()
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(new Error(error));
      });
  });

  this.After(function (scenario, callback) {
    this.api.deleteCollection()
      .then(function () {
        this.api.disconnect();

        callback();
      }.bind(this))
      .catch(function () {
        callback();
      });
  });

  this.After('@unsubscribe', function (scenario, callback) {
    async.each(Object.keys(this.api.subscribedRooms), (socketName, callbackSocketName) => {
      async.each(Object.keys(this.api.subscribedRooms[socketName]), (room, callbackRoom) => {
        this.api.unsubscribe(room, socketName)
          .then(() => callbackRoom())
          .catch(error => callbackRoom(error));
      }, error => {
        this.api.subscribedRooms[socketName] = {};

        callbackSocketName(error);
      });
    }, error => callback(error));
  });
};

module.exports = myHooks;

var setAPI = function (world, apiName) {
  var
    Api = require('./api' + apiName),
    api = new Api();

  api.init(world);

  return api;
};
