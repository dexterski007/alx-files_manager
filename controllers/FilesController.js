import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { mkdir, writeFile } from 'fs';
import Queue from 'bull';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const fileQ = new Queue('fileQ');
    const validTypes = ['folder', 'file', 'image'];
    const {
      name,
      type,
      parentId = '0',
      isPublic = false,
      data,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !validTypes.includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let parentFile = null;
    if (parentId !== '0') {
      try {
        parentFile = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(parentId) });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      } catch (err) {
        console.error(err);
        return res.status(500).send();
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      await dbClient.dbClient.collection('files').insertOne(fileDocument);
      return res.status(201).send({
        id: fileDocument._id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPath = path.join(folderPath, uuidv4());
    const fileData = Buffer.from(data, 'base64');
    mkdir(folderPath, { recursive: true }, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      return true;
    });
    writeFile(localPath, fileData, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      return true;
    });
    fileDocument.localPath = localPath;
    await dbClient.dbClient.collection('files').insertOne(fileDocument);

    fileQ.add({
      userId: fileDocument.userId,
      fileId: fileDocument._id,
    });
    return res.status(201).json({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
    });
  }
}

module.exports = FilesController;
