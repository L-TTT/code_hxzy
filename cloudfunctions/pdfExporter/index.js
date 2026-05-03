const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f',
  traceUser: true,
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { includePhotos } = event

  try {
    const events = await db.collection('events')
      .where({ openid: OPENID })
      .orderBy('date', 'asc')
      .get()

    const user = await db.collection('users').where({ openid: OPENID }).get()

    const photosWithUrls = []
    if (includePhotos !== false) {
      const allFileIds = events.data
        .flatMap(e => (e.photos || []).map(p => p.fileId))
        .filter(Boolean)

      if (allFileIds.length > 0) {
        const urlRes = await cloud.getTempFileURL({ fileList: allFileIds })
        const urlMap = {}
        urlRes.fileList.forEach(f => {
          urlMap[f.fileID] = f.tempFileURL
        })

        events.data.forEach(e => {
          if (e.photos) {
            e.photos = e.photos.map(p => ({
              ...p,
              tempUrl: urlMap[p.fileId] || '',
            }))
          }
        })
      }
    }

    return {
      code: 0,
      data: {
        userInfo: user.data[0] || {},
        events: events.data,
        includePhotos: includePhotos !== false,
      },
    }
  } catch (err) {
    console.error('pdfExporter error:', err)
    return { code: -1, message: err.message }
  }
}
