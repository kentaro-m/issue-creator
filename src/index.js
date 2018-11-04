const AppConfig = require('config')
const { createIssue } = require('./handler')

exports.handler = async (event) => {
  console.log(JSON.stringify(event))
  const response =  await createIssue(event, AppConfig)
  return response
}
