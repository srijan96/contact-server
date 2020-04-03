var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:6969', function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('connected to mongodb!');
    }
});

//Todo: change it to the real schema
var contactSchema = mongoose.Schema({
    name: String,
    question: String,
    answer: String,
    created: {type: Date, default: Date.now}
})

var dataAccessObject = mongoose.model('Contact', contactSchema);

exports.saveData = function(data, callBack) {
    var toSave = new dataAccessObject({name: data.name, question: data.question, answer: data.answer});
    toSave.save(function(err){
        if (err) console.log(err)
        callBack(err);
    })
}

//Fetching everything to see mongo is responding as expected.
exports.getData = function(callBack) {
    
    dataAccessObject.find({}, function(err, doc){
        if (err) {
            console.log(err);
        }
        console.log(doc);
    });
}