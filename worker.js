import Queue from 'bull';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import imageThumb from 'image-thumbnail';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job) => {
  try {
    const { fileId, userId } = job.data;

    if (!fileId) {
      throw new Error('Missing fileId');
    }
    if (!userId) {
      throw new Error('Missing fileId');
    }
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) {
      throw new Error('File not found');
    }
    const dir = file.localPath;
    fs.writeFileSync(`${dir}_500`, await imageThumb(dir, { width: 500 }));
    fs.writeFileSync(`${dir}_250`, await imageThumb(dir, { width: 250 }));
    fs.writeFileSync(`${dir}_100`, await imageThumb(dir, { width: 100 }));
  } catch (err) {
    console.error(err);
  }
});

module.exports = fileQueue;
