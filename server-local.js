'use strict';

const app = require('./express/server');

const server = app.listen(3000, '0.0.0.0', err => console.log(err|| 'Listening on port 3000...'))

const io = require('socket.io')(server)

const multipart = require('connect-multiparty');
const multipartMiddleware = multipart({ uploadDir: './tmp' });

var uploader = require('./uploader-node.js')('tmp')

const Datastore = require('nedb-promises')

const fs = require('fs')

const db = {} 
db.onlines      = Datastore.create('onlines.exe')
db.messagesData = Datastore.create('messagesData.exe')
db.files        = Datastore.create('files.exe')

app.use(express.static('dist'))
// Connected People
const onlines = new Set()


app.post('/uploads', multipartMiddleware, function(req, res) {
	uploader.post(req, function(status, filename, original_filename, identifier) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "content-type")

		setTimeout(function () {
			res.send(status);
		}, 500);
	});
});

  app.options('/uploads', function(req, res){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "content-type")
    
    res.status(200).send();
  });
  
  // Handle status checks on chunks through Uploader.js
  app.get('/uploads', function(req, res) {
    uploader.get(req, function(status, filename, original_filename, identifier) {
        console.log('GET', status);
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "content-type")
        res.status(status == 'found' ? 200 : 204).send(status);
    });
  });
  

  app.get('/download/:identifier', function(req, res) {
    const file = `./tmp/${req.params.identifier}`
    res.download(file)
  });

app.get('/*', (req,res)=>{
    res.redirect('/')
})

io.on('connection', socket =>{

    socket.on('getFiles', ()=>{
        fs.readdir( './tmp', function( err, files ) {
            files = files.sort((f1, f2)=>{
                return f1.toLowerCase() > f2.toLowerCase()
            })
            io.emit('getFiles', files)
        })
    })

    socket.on('fileAdded', (file) =>{
        socket.broadcast.emit('fileAdded', file)
    })

    socket.on('complete', () =>{
        socket.broadcast.emit('complete')
    })

    socket.on('fileError', () =>{
        socket.broadcast.emit('fileError')
    })

    socket.on('disconnect', ()=>{
        onlines.delete(socket.name)
        socket.name = null
        io.emit('initOnlines', [...onlines])
    })

    socket.on('removeOnline', name =>{
        onlines.delete(name)
        io.emit('initOnlines', [...onlines])
    })

    socket.on('newName', name =>{
        const oldName = socket.name
        const newName = name 
        onlines.delete(oldName)
        socket.broadcast.emit('changedName', [oldName, newName])
        socket.name = newName
        onlines.add(newName)
        io.emit('initOnlines', [...onlines])
    })

    socket.on('initState', async (name)=>{
        socket.name = name || null
        if(name){
            onlines.add(name)
            io.emit('initOnlines', [...onlines])
        }

        const messagesData = await db.messagesData.find({}).sort({date: 1})
        socket.emit('initState', messagesData)
        
    })

    socket.on('addOnline', online =>{
        socket.name = online
        onlines.add(online)
        io.emit('initOnlines', [...onlines])
    })

    socket.on('addTyper', typer => {
        io.emit('addTyper', typer)
    })

    socket.on('removeTyper', typer =>{
        io.emit('removeTyper', typer)
    })

    socket.on('addMessage', async person =>{
        
        await db.messagesData.insert({...person, date: Date.now()})
        io.emit('addMessage', person)
    })
})






