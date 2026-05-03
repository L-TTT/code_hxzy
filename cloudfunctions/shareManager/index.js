// cloudfunctions/shareManager/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: 'toust-d9gu1e0km340d2d2f' })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, eventId, shareType } = event

  try {
    switch (action) {
      case 'generateShareCard':
        return await generateShareCard(eventId, shareType)
      case 'recordShare':
        return await recordShare(wxContext.OPENID, eventId)
      default:
        return { code: -1, message: '无效的操作类型' }
    }
  } catch (err) {
    console.error('shareManager error:', err)
    return { code: -1, message: err.message, errCode: err.errCode }
  }
}

async function generateShareCard(eventId, shareType) {
  const event = await db.collection('events').doc(eventId).get()
  
  if (!event.data) {
    return { code: -1, message: '事件不存在' }
  }
  
  const eventData = event.data
  const user = await db.collection('users').where({
    openid: eventData.openid
  }).get()
  
  return {
    code: 0,
    data: {
      event: eventData,
      userInfo: user.data[0],
      template: shareType || 'default'
    }
  }
}

async function recordShare(openid, eventId) {
  await db.collection('share_records').add({
    data: {
      openid: openid,
      eventId: eventId,
      sharedAt: db.serverDate()
    }
  })
  return { code: 0, message: '记录成功' }
}
