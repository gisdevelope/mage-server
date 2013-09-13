var mongoose = require('mongoose')
  , Counter = require('./counter');

var Schema = mongoose.Schema;
// Creates the Schema for the Features object (mimics ESRI)
var AttachmentSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  contentType: { type: String, required: false },  
  size: { type: String, required: false },  
  name: { type: String, required: false },
  relativePath: { type: String, required: true }
});

// Creates the Schema for the Attachments object
var FeatureSchema = new Schema({
  geometry: Schema.Types.Mixed,
  properties: Schema.Types.Mixed,
  attachments: [AttachmentSchema]
});

FeatureSchema.index({geometry: "2dsphere"});
FeatureSchema.index({'properties.OBJECTID': 1});
FeatureSchema.index({'properties.timestamp': 1});
FeatureSchema.index({'attachments.id': 1});

var models = {};

var featureModel = function(layer) {
  var name = layer.collectionName;
  var model = models[name];
  if (!model) {
    // Creates the Model for the Features Schema
    var model = mongoose.model(name, FeatureSchema, name);
    models[name] = model;
  }

  return model;
}

exports.getFeatures = function(layer, filter, callback) {
  var conditions = {};
  
  var query = featureModel(layer).find(conditions).lean(false);

  // Filter by geometry
  if (filter.geometry) {
    query.where('geometry').intersects.geometry(filter.geometry);
  }

  query.exec(function (err, features) {
    if (err) {
      console.log("Error finding features in mongo: " + err);
    }

    callback(features);
  });
}

exports.getFeatureByObjectId = function(layer, objectId, callback) {
  var query = {'properties.OBJECTID': objectId};
  featureModel(layer).findOne(query, function (err, feature) {
    if (err) {
      console.log("Error finding feature in mongo: " + err);
    }

    callback(feature);
  });
}

exports.getFeatureById = function(layer, id, callback) {
  var fields = {'attachments': 0}; 
  featureModel(layer).findOne(id, fields, function (err, feature) {
    if (err) {
      console.log("Error finding feature in mongo: " + err);
    }

    callback(feature);
  });
}

exports.createFeature = function(layer, data, callback) {
  var name = 'feature' + layer.id;
  Counter.getNext(name, function(id) {
    var properties = data.properties ? data.properties : {};
    properties.OBJECTID = id;
    properties.timestamp = new Date();

    var feature = {
      geometry: {
        type: 'Point',
        coordinates: [data.geometry.x, data.geometry.y]
      },
      properties: properties
    };

    featureModel(layer).create(feature, function(err, newFeature) {
      if (err) {
        console.log(JSON.stringify(err));
      }

      callback(newFeature);
    });
  });
}

exports.createGeoJsonFeature = function(layer, feature, callback) {
  var name = 'feature' + layer.id;
  Counter.getNext(name, function(id) {
    var properties = feature.properties ? feature.properties : {};
    properties.OBJECTID = id;

    featureModel(layer).create(feature, function(err, newFeature) {
      if (err) {
        console.log('Error creating feature', err);
        console.log('feature is: ', feature);
      }

      callback(err, newFeature);
    }); 
  });
}

exports.updateFeature = function(layer, data, callback) {
  var query = {'properties.OBJECTID': data.properties.OBJECTID};

  var properties = data.properties ? data.properties : {};
  var update = {
    geometry: {
      type: 'Point',
      coordinates: [data.geometry.x, data.geometry.y]
    },
    properties: properties
  };

  var options = {new: true};
  featureModel(layer).findOneAndUpdate(query, update, options, function (err, feature) {
    if (err) {
      console.log('Could not update feature', err);
    }

    callback(err, feature);
  });
}

exports.removeFeature = function(layer, objectId, callback) {
  var query = {'properties.OBJECTID': objectId};
  featureModel(layer).findOneAndRemove(query, function (err, feature) {
    if (err) {
      console.log('Could not remove feature', err);
    }

    callback(err, objectId, feature);
  });
}

exports.getAttachments = function(feature, callback) {
  callback(feature.get('attachments'));
}

exports.getAttachment = function(feature, attachmentId, callback) {
  var attachments = feature.get('attachments').filter(function(attachment) {
    return (attachment.id == attachmentId);
  });

  var attachment = attachments.length ? attachments[0] : null;
  callback(attachment);
}

exports.addAttachment = function(layer, objectId, file, callback) {
  var attachment = {
    id: file.id,
    contentType: file.type,  
    size: file.size,  
    name: file.name,
    relativePath: file.relativePath
  };

  var condition = {'properties.OBJECTID': objectId};
  var update = {'$push': { attachments: attachment } };
  featureModel(layer).update(condition, update, function(err, feature) {
    if (err) {
      console.log('Error updating attachments from DB', err);
    }

    callback(err, attachment);
  });
}

exports.updateAttachment = function(layer, attachmentId, file, callback) {
  var condition = {'attachments.id': attachmentId};
  var update = {
    '$set': {
      'attachments.$.name': filesname,
      'attachments.$.type': file.type,
      'attachments.$.size': file.size
    }
  };

  featureModel(layer).update(condition, update, function(err, feature) {
    if (err) {
      console.log('Error updating attachments from DB', err);
    }

    callback(err);
  });
}

exports.removeAttachments = function(feature, attachmentIds, callback) {
  feature.update({'$pull': {attachments: {id: {'$in': attachmentIds}}}}, function(err, number, raw) {
    if (err) {
      console.log('Error pulling attachments from DB', err);
    }

    callback(err);
  });
}