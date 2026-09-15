const mongoose = require('mongoose');
const shippingProviderSchema = new mongoose.Schema({
  key:{type:String,required:true,unique:true}, name:{type:String,required:true}, enabled:{type:Boolean,default:false},
  countries:{type:[String],default:[]}, rateMode:{type:String,enum:['api','configured'],default:'api'}, configuredRate:{type:Number,default:0},
},{timestamps:true});
module.exports=mongoose.model('ShippingProvider',shippingProviderSchema);