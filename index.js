const express = require('express');
const path = require('path');
const fs = require('fs');
const {spawn, exec, execSync} = require('child_process');
const imageProcessWrapper = require('./file');
const app = new express;
const server = require('http').createServer(app);
const {init,createDataObject} = require('./socket');
init(server);
require('dotenv').config();
// const command = 'fawkes -d';
// const runFawkes = directoryName => exec('${command} ${directoryName} --mode min');
const runFawkes = directoryName => exec(`python ./fawkes/fawkes/protection.py --directory ${directoryName} --mode min`)
// const runFawkes = directoryName => exec('fawkes --directory C:/Users/MikeBeacher/Documents/funApps/cloakview-backend/imgs/5f358c7b3103c521161f1a25 --mode min')
const rimraf = require('rimraf');
const jwt = require('jsonwebtoken');
// fawkes -d ./imgs --mode min
const setUpFawkesProcess = (subpath,dataCallback,doneCallback)=>{
      console.log('subpath is before ' + subpath);
      strReplace = subpath.replace(new RegExp(/\\/g),"/"); //change strReplace to subpath and comment out if running on windows
      console.log('subpath after is ' + strReplace);
      const process = runFawkes(strReplace);
      process.stdout.on('data',data=>{
            console.log('data is' +data);
            const segments = data.split(' ');

            if(segments.find(name=>name.match(/cost/))) return dataCallback('TIME_ELASPED',parseFloat(segments[segments.findIndex(name=>name.match(/cost/)) + 1]));

            const percentageSeg = segments.find(name=>name.match('/20'));
            if(!percentageSeg) return;

            const percentageSegArray = percentageSeg.split('/');
            const percentage = parseInt((percentageSegArray[0]/percentageSegArray[1])*100);

            const ETAIndex = segments.findIndex(name=>name.match(/ETA/));
            const time = segments[ETAIndex+1];
            let secondETA = time.match(/:/)
            ? (()=>{
                  const [minute,second] = time.split(':').map(str=>parseInt(str));
                  return minute*60 + second;
            })()
            : parseInt(time.slice(0,time.length-1));
            return dataCallback('TIME_UPDATE',percentage,secondETA);
      })
      process.on('close',code=>{
            console.log('closed',code);
            if(!code) doneCallback(true);
            else doneCallback(false);
      });
      process.on('error',code=>console.log(`Error ${code}`));
      return ()=>process.kill(2);
}

const cancelMap = new Map;

const runProcess = (imageBlob)=>imageProcessWrapper(imageBlob,(subpath,imageName,id)=>{
      const newImagePath = path.join(subpath,`${id}_min_cloaked.png`);
      let timeElasped = null;
      let timeElaspedCallback = null;
      const delPath = ()=>rimraf.sync(subpath);

      const [token,progressMutationInterface,doneMutationInterface] = createDataObject(id)
      const killProcess = setUpFawkesProcess(subpath,(status,info1,info2)=>{
            if(status === 'TIME_ELASPED'){
                  timeElasped = info1;
                  return timeElaspedCallback && timeElaspedCallback(timeElasped);
            }
            return progressMutationInterface(info2,info1);
      },async ()=>{
            const tE = timeElasped || await new Promise(r=>timeElaspedCallback = r);
            const photo = fs.readFileSync(newImagePath).toString('binary');
            await doneMutationInterface(photo,tE);
            rimraf.sync(subpath);
      })
      if(!cancelMap.get(id)) cancelMap.set(id,()=>{
            killProcess();
            delPath();
      })

      return token;
})

app.use(require('helmet')());
app.use(require('morgan')('common'));
app.use(require('cors')());
app.use(require('body-parser')());

const handleWrapper = func=>async (req,res)=>{
      let data;
      try{
            data = await func(req,res);
      }
      catch(e){
            console.log(e);
            return res.send({error:'Cannot initalize your image, try again later.'});
      }
      return res.send({error:false,data});
}

app.post('/',handleWrapper((req,res)=>{
      const {image} = req.body;
      if(!image) throw Error("That image does not exist");
      return runProcess(image);
}))

app.post('/cancel',handleWrapper((req,res)=>{
      const {token} = req.body;
      if(!token) throw Error("You don't have an authentication token.");
      const {id} = jwt.verify(token,process.env.SECRET_KEY);
      console.log(cancelMap,id);
      return cancelMap.get(id)();
}))

const PORT = process.env.PORT || 5000;
server.listen(PORT,()=>console.log(`Listening on port ${PORT}`))
