const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f',
  traceUser: true,
})

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, fileName, eventType, fileIds } = event

  try {
    switch (action) {
      case 'getUploadUrl':
        return getUploadUrl(OPENID, fileName, eventType)
      case 'getTempUrl':
        return await getTempUrl(fileIds)
      case 'deleteFile':
        return await deleteFile(fileIds)
      default:
        return { code: -1, message: '无效的操作类型' }
    }
  } catch (err) {
    console.error('uploadManager error:', err)
    return { code: -1, message: err.message }
  }
}

function getUploadUrl(openid, fileName, eventType) {
  if (!fileName) {
    return { code: -1, message: '文件名不能为空' }
  }

  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substr(2, 9)
  const ext = fileName.split('.').pop() || 'jpg'
  const cloudPath = `images/${openid}/${eventType || 'default'}/${timestamp}_${randomStr}.${ext}`

  return { code: 0, data: { cloudPath } }
}

async function getTempUrl(fileIds) {
  if (!fileIds || fileIds.length === 0) {
    return { code: 0, data: [] }
  }

  const result = await cloud.getTempFileURL({ fileList: fileIds })
  return {
    code: 0,
    data: result.fileList.map(f => ({
      fileID: f.fileID,
      tempFileURL: f.tempFileURL,
      status: f.status,
    })),
  }
}

async function deleteFile(fileIds) {
  if (!fileIds || fileIds.length === 0) {
    return { code: -1, message: '文件列表不能为空' }
  }

  const result = await cloud.deleteFile({ fileList: fileIds })
  return { code: 0, data: result.fileList }
}
