const cloud = require('wx-server-sdk')

cloud.init({
  env: 'toust-d9gu1e0km340d2d2f'
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      await db.collection('users').doc(user._id).update({
        data: {
          lastLoginTime: db.serverDate()
        }
      })

      return {
        code: 0,
        message: '登录成功',
        data: {
          isNewUser: false,
          userInfo: user
        }
      }
    }

    return {
      code: 0,
      message: '新用户',
      data: {
        isNewUser: true,
        openid: openid
      }
    }
  } catch (err) {
    console.error('login error:', err)
    return {
      code: -1,
      message: '登录失败',
      error: err.message,
      errCode: err.errCode
    }
  }
}
