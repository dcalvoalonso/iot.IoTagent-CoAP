'use strict';

var iotAgentLib = require('iotagent-node-lib'),
    async = require('async'),
    apply = async.apply,
    context = {
        op: 'IoTAgentCoAP.Agent'
    },
    config = require('../config'),
    coap = require('coap');


function initSouthbound(callback) {
    var server = coap.createServer();
    server.on('request', manageCoAPJSONRequest);
    server.listen(function() {
        callback();
    })
}


function guessType(attribute, device) {
    if (device.active) {
        for (var i = 0; i < device.active.length; i++) {
            if (device.active[i].name === attribute) {
                return device.active[i].type;
            }
        }
    }
}

function processJsonActiveAttributes(data, deviceId,apiKey,device) {
    var values = [];

    iotAgentLib.logModule.debug(context,
        'Processing multiple measures for device [%s] with apiKey [%s]', deviceId, apiKey);

    for (var i in data) {
        if (data.hasOwnProperty(i)) {
            if (i !== 'deviceId' && i !== "apiKey") {
                values.push({
                    name: i,
                    type: guessType(i, device),
                    value: data[i]
                });
            }
        }
    }

    return values;
}

function manageCoAPJSONRequest(req, res) {
    var values;
    var queryArguments;

    iotAgentLib.logModule.info(context, 'IoT Agent received CoAP request');

    if (req.url !== '/iot/coap') {
        res.statusCode = '4.04';
        return res.end('Url not found');
    }

    if (req.method !== 'POST') {
        res.statusCode = '5.01';
        return res.end('Method not implemented'); 
    }

    if (!req.payload) {
        res.statusCode = '4.00';
        return res.end('Payload is mandatory');  
    }

    var payload = {};
    try {
        payload = JSON.parse(req.payload);
    } catch (e) {
        res.statusCode = '4.00';
        return res.end('Could not parse payload:'+ e);  
    }

    if (!payload.deviceId || !payload.apiKey) {
        res.statusCode = '4.00';
        res.end('deviceId and apiKey are mandatory'); 
    }

    iotAgentLib.retrieveDevice(payload.deviceId, payload.apiKey, function(error, device) {
        if (error) {
            res.statusCode = '4.04';
            res.end('Device not found:' + JSON.stringify(error));
        } else {
            values = processJsonActiveAttributes(payload, payload.deviceId, payload.apiKey, 
                device);
            iotAgentLib.update(device.name, device.type, '', values, device, function(error) {
                if (error) {
                    res.statusCode = '5.00';
                    res.end('Error updating the device');
                } else {
                    res.statusCode = '2.00';
                    res.end('Device successfully updated');
                }        
            });
        }
    }); 
 
}

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {

    iotAgentLib.activate(config.iota, function(error) {
        if (error) {
            callback(error);
        } else {
            iotAgentLib.logModule.info(context, 'IoT Agent services activated');
            initSouthbound(function (error) {
                if (error) {
                    iotAgentLib.logModule.error(
                        'Could not initialize South' +
                        'bound API due to the following error: %s', error);
                } else {
                    iotAgentLib.logModule.info('South bound API started successfully');
                }   
            }); 
        }
    });
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    iotAgentLib.logModule.info(context, 'Stopping IoT Agent');
    async.series([
        iotAgentLib.resetMiddlewares,
        iotAgentLib.deactivate
    ], callback);
}

exports.start = start;
exports.stop = stop;
