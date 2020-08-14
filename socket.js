const jwt = require('jsonwebtoken');
let io;
const dataMap = new Map;

const generateId = (m = Math, d = Date, h = 16, s = s => m.floor(s).toString(h)) =>
    s(d.now() / 1000) + ' '.repeat(h).replace(/./g, () => s(m.random() * h))

const messages = ['Critical Error','Update','Result'];

const sendWrapper = (message,func,persistent)=>async (id,...args)=>{
      if(!dataMap.has(id)) return;
      if(!dataMap.get(id).socketConnected){
            if(!persistent) return;
            await new Promise(r=>dataMap.get(id).connectCallback.push(r))
      }
      const ackid = generateId();
      const data = await func(id,...args);
      io.to(id).emit(message,{
            ackid,
            data,
      })
      return await new Promise(r=>dataMap.get(id).acknowledgement.push([ackid,r]))
}

const update = sendWrapper('Update',(id)=>dataMap.get(id).data,false)
const sendResult = sendWrapper('Result',async (id,photoData,timeElasped)=>({photoData,timeElasped}),true);

const init = server=>{
      io = require('socket.io')(server);
      io.on('connect',socket=>{
            const error = ()=>{
                  socket.emit('Critical Error');
                  socket.disconnect();
            }
            const {token} = socket.handshake.query;
            if(!token) error();
            let id;
            try{
                  id = jwt.verify(token,process.env.SECRET_KEY).id;
            }
            catch(e){
                  console.log(e);
                  error();
            }
            if(!dataMap.has(id)) return error();

            const getSpecficInfo = info=>dataMap.get(id)[info];
            const setSpecificInfo = (key,value)=>dataMap.get(id)[key] = value;

            // if(getSpecficInfo('socketConnected')) return error();
            setSpecificInfo('socketConnected',getSpecficInfo('socketConnected')+1);
            socket.on('disconnect',()=>{
                  setSpecificInfo('socketConnected',getSpecficInfo('socketConnected')-1);
            })

            for(let m of messages)
                  socket.on(m,async (data)=>{
                        const popQueue = getSpecficInfo('popQueue').get(m);
                        const persistentQueue = getSpecficInfo('persistentQueue').get(m);
                        if(!popQueue || !persistentQueue) return;
                        for(let callback of persistentQueue) await callback(data);
                        for(let callback of popQueue) await callback(data);
                        getSpecficInfo('popQueue').set(m,[]);

                        if(data.ackid){
                              const ackQueue = getSpecficInfo('acknowledgement');
                              const arr = ackQueue.find(e=>e[0]=data.ackid);
                              if(arr) arr[1](data);
                        }
                  })

            socket.join(id);
            console.log(id,dataMap.get(id));
            update(id);
            getSpecficInfo('connectCallback').forEach(f=>f());
            setSpecificInfo('connectCallback',[]);
      })
};

const makeMapOfMessage = ()=>{
      const map = new Map;
      messages.forEach(e=>map.set(e,[]));
      return map;
}

const createDataObject = (id)=>{
      const object = {
            popQueue:makeMapOfMessage(),
            persistentQueue:makeMapOfMessage(),
            acknowledgement:[],
            data:{
                  done:false,
                  ETA:null,
                  progress:null,
                  timeElasped:null,
            },
            connectCallback:[],
            socketConnected:0,
      }
      dataMap.set(id,object);
      const token = jwt.sign({id},process.env.SECRET_KEY);
      const mutateWrapper = func=>(...args)=>{
            if(!dataMap.has(id)) return;
            const dataObj = dataMap.get(id).data;
            const result = func(dataObj,...args);
            update(id);
            return result;
      }

      const progressMutationInterface = mutateWrapper((dataObj,eta,progress)=>{
            dataObj.ETA = eta;
            dataObj.progress = progress;
      })

      const doneMutationInterface = async (photo,timeElasped)=>{
            await sendResult(id,photo,timeElasped);
            dataMap.delete(id);
      }

      return [token,progressMutationInterface,doneMutationInterface]
}

module.exports = {
      init,
      createDataObject
}
