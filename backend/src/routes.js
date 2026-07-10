import express from 'express';
import upload from './upload.js'
import {uploadFile, getFiles, downloadFile , getRoom} from './controller.js'

const router = express.Router()

router.post('/upload' , upload.single('file'), uploadFile)

router.get('/files/:room_id', getFiles)
router.get('/room' , getRoom)

router.post('/download/:id', downloadFile)


export default router;
