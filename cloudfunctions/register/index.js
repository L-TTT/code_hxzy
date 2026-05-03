const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f'
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { nickName, avatarUrl, role } = event

  if (!nickName || !role) {
    return {
      code: -1,
      message: '昵称和角色不能为空'
    }
  }

  if (!['male', 'female'].includes(role)) {
    return {
      code: -1,
      message: '角色选择无效'
    }
  }

  try {
    const existingUser = await db.collection('users').where({
      openid: openid
    }).get()

    if (existingUser.data.length > 0) {
      return {
        code: -1,
        message: '该微信已注册，请直接登录'
      }
    }

    const now = db.serverDate()
    const result = await db.collection('users').add({
      data: {
        openid: openid,
        nickName: nickName,
        avatarUrl: avatarUrl || '',
        role: role,
        createdAt: now,
        lastLoginTime: now
      }
    })

    return {
      code: 0,
      message: '注册成功',
      data: {
        _id: result._id,
        openid: openid,
        nickName: nickName,
        avatarUrl: avatarUrl || '',
        role: role
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '注册失败',
      error: err.message
    }
  }
}
