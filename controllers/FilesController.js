import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const validTypes = ['folder', 'file', 'image'];
    const {
      name, type, parentId = '0', isPublic = false, data,
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
        return res.status(400).json({ error: 'Invalid parentId' });
      }
    }

    const fileDocument = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? '0' : new ObjectId(parentId),
    };

    if (type === 'folder') {
      const newFile = await dbClient.dbClient.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: newFile.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPath = path.join(folderPath, uuidv4());
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const fileData = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileData);
      fileDocument.localPath = localPath;
      const result = await dbClient.dbClient.collection('files').insertOne(fileDocument);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });
    } catch (err) {
      console.error('Cannot save file', err);
      return res.status(500).json({ error: 'cannot save the file' });
    }
  }
}

module.exports = FilesController;
