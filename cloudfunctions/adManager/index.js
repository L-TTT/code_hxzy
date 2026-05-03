const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f',
  traceUser: true,
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action, points } = event

  try {
    switch (action) {
      case 'getPoints':
        return await getPoints(OPENID)
      case 'consumePoints':
        return await consumePoints(OPENID, points)
      case 'recordAdWatch':
        return await recordAdWatch(OPENID)
      default:
        return { code: -1, message: '无效的操作类型' }
    }
  } catch (err) {
    console.error('adManager error:', err)
    return { code: -1, message: err.message }
  }
}

async function getPoints(openid) {
  const user = await db.collection('users').where({ openid }).get()
  if (!user.data.length) return { code: -1, message: '用户不存在' }

  return {
    code: 0,
    data: {
      points: user.data[0].points || 0,
      adWatchCount: user.data[0].adWatchCount || 0,
    },
  }
}

async function consumePoints(openid, points) {
  if (!points || points <= 0) {
    return { code: -1, message: '积分数量无效' }
  }

  const user = await db.collection('users').where({ openid }).get()
  if (!user.data.length) return { code: -1, message: '用户不存在' }

  const current = user.data[0].points || 0
  if (current < points) {
    return { code: -1, message: '积分不足', data: { points: current } }
  }

  const newPoints = current - points
  await db.collection('users').doc(user.data[0]._id).update({
    data: { points: newPoints },
  })

  return { code: 0, data: { points: newPoints } }
}

async function recordAdWatch(openid) {
  const user = await db.collection('users').where({ openid }).get()
  if (!user.data.length) return { code: -1, message: '用户不存在' }

  const current = user.data[0].points || 0
  const newPoints = current + 30

  await db.collection('users').doc(user.data[0]._id).update({
    data: {
      points: newPoints,
      adWatchCount: (user.data[0].adWatchCount || 0) + 1,
      lastAdWatchTime: db.serverDate(),
    },
  })

  return { code: 0, message: '获得30积分', data: { points: newPoints } }
}
