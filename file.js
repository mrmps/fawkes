const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const generateId = (m = Math, d = Date, h = 16, s = s => m.floor(s).toString(h)) =>
    s(d.now() / 1000) + ' '.repeat(h).replace(/./g, () => s(m.random() * h))

const imagedir = path.join(__dirname,'images');
const getsubpath = name=>path.join(imagedir,name);

const readBigDirectory = ()=>fs.readdirSync(imagedir)
const readSmallDirectory = sub=>fs.readdirSync(getsubpath(sub))

const clearImageCache = ()=>readBigDirectory().forEach(name=>rimraf.sync(getsubpath(name)))

let firstTimeActivated = true;

const processWrapper = async (func)=>{
      if(firstTimeActivated) {
            console.log('first');
            clearImageCache();
            firstTimeActivated = false;
      }
      const id = generateId();
      const subpath = getsubpath(id);
      fs.mkdirSync(subpath);

      let done = false;
      setTimeout(()=>{
            if(!done) rimraf.sync(subpath);
      },1000*60*60*24*2);
      const result = await func(subpath);
      done = true;
      // rimraf.sync(subpath);
      return result;
}

const imageProcessWrapper = (imageBlob,func)=>processWrapper(async (subpath)=>{
      const id = generateId();
      const imageName = `${id}.jpg`;
      const subpathImg = path.join(subpath,imageName);
      const blob = Buffer.from(imageBlob,'binary');
      fs.writeFileSync(subpathImg,blob,'binary');
      const result = await func(subpath,imageName,id);
      return result;
})

module.exports = imageProcessWrapper;
