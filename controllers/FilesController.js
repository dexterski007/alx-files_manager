import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { mkdir, writeFile } from 'fs';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const fileQ = new Queue('fileQ');
    const dir = process.env.FOLDER_PATH || '/tmp/files_manager';

    async function getIdKey(req) {
      const userInfo = { userId: null, key: null };

      const token = req.header('X-Token');
      if (!token) return userInfo;

      userInfo.key = `auth_${token}`;
      userInfo.userId = await redisClient.get(userInfo.key);

      return userInfo;
    }

    const { userId } = await getIdKey(req);

    function isValidUser(id) {
      try {
        ObjectId(id);
      } catch (error) {
        return false;
      }
      return true;
    }

    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.dbClient.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileName = req.body.name;
    if (!fileName) return res.status(400).json({ error: 'Missing name' });

    const fileType = req.body.type;
    if (!fileType || !['folder', 'file', 'image'].includes(fileType)) return res.status(400).json({ error: 'Missing type' });

    const fileData = req.body.data;
    if (!fileData && fileType !== 'folder') return res.status(400).json({ error: 'Missing data' });

    const publicFile = req.body.isPublic || false;
    let parentId = req.body.parentId || 0;
    parentId = parentId === '0' ? 0 : parentId;
    if (parentId !== 0) {
      const parentFile = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileInsertData = {
      userId: user._id,
      name: fileName,
      type: fileType,
      isPublic: publicFile,
      parentId,
    };

    if (fileType === 'folder') {
      await dbClient.dbClient.collection('files').insertOne(fileInsertData);
      return res.status(201).json({
        id: fileInsertData._id,
        userId: fileInsertData.userId,
        name: fileInsertData.name,
        type: fileInsertData.type,
        isPublic: fileInsertData.isPublic,
        parentId: fileInsertData.parentId,
      });
    }

    const fileUid = uuidv4();

    const decData = Buffer.from(fileData, 'base64');
    const filePath = `${dir}/${fileUid}`;

    mkdir(dir, { recursive: true }, (error) => {
      if (error) return res.status(400).json({ error: error.message });
      return true;
    });

    writeFile(filePath, decData, (error) => {
      if (error) return res.status(400).json({ error: error.message });
      return true;
    });

    fileInsertData.localPath = filePath;
    await dbClient.dbClient.collection('files').insertOne(fileInsertData);

    fileQ.add({
      userId: fileInsertData.userId,
      fileId: fileInsertData._id,
    });

    return res.status(201).json({
      id: fileInsertData._id,
      userId: fileInsertData.userId,
      name: fileInsertData.name,
      type: fileInsertData.type,
      isPublic: fileInsertData.isPublic,
      parentId: fileInsertData.parentId,
    });
  }

  static async getShow(req, res) {
    async function getIdKey(req) {
      const userInfo = { userId: null, key: null };

      const token = req.header('X-Token');
      if (!token) return userInfo;

      userInfo.key = `auth_${token}`;
      userInfo.userId = await redisClient.get(userInfo.key);

      return userInfo;
    }

    const { userId } = await getIdKey(req);

    function isValidUser(id) {
      try {
        ObjectId(id);
      } catch (error) {
        return false;
      }
      return true;
    }

    if (!isValidUser(userId)) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.users.findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const argId = req.params.id || '';
    const file = await dbClient.users.findOne({ _id: ObjectId(argId), userId: user._id });
    if (!file) return res.status(404).send({ error: 'Not found' });

    return res.status(200).send({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    async function getIdKey(req) {
      const userInfo = { userId: null, key: null };

      const token = req.header('X-Token');
      if (!token) return userInfo;

      userInfo.key = `auth_${token}`;
      userInfo.userId = await redisClient.get(userInfo.key);

      return userInfo;
    }

    const { userId } = await getIdKey(req);

    function isValidUser(id) {
      try {
        ObjectId(id);
      } catch (error) {
        return false;
      }
      return true;
    }

    if (!isValidUser(userId)) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.dbClient.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    let parentId = req.query.parentId || 0;
    if (parentId === '0') parentId = 0;
    if (parentId !== 0) {
      if (!isValidUser(parentId)) return res.status(401).send({ error: 'Unauthorized' });
      parentId = ObjectId(parentId);

      const folder = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!folder || folder.type !== 'folder') return res.status(200).send([]);
    }

    const page = req.query.page || 0;

    const addmath = { $and: [{ parentId }] };
    let data = [{ $match: addmath }, { $skip: page * 20 }, { $limit: 20 }];
    if (parentId === 0) data = [{ $skip: page * 20 }, { $limit: 20 }];

    const pagination = await dbClient.dbClient.collection('files').aggregate(data);
    const paginationArray = [];

    await pagination.forEach((file) => {
      const paginationItem = {
        id: file._id,
        userID: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      };
      paginationArray.push(paginationItem);
    });

    return res.status(200).send(paginationArray);
  }
}

module.exports = FilesController;
