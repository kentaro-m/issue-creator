const Octokit = require('@octokit/rest')
const qs = require('querystring')
const version = require('../package.json').version

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json'
  }
})

const getExecuteUserInfo = (executeUser, users) => {
  for (const user of users) {
    if (executeUser === user.slack) {
      return user
    }
  }
  return {}
}

exports.createIssue = async function (event, config) {
  try {
    const githubToken = process.env.GITHUB_TOKEN
    const { baseUrl, repoOwner, repoName } = config.github

    const params = qs.parse(event.body)
    const user = params.user_name
    const commandText = params.text

    if (!repoOwner) {
      throw new Error('No repoOwner found on the configuration file.')
    }

    if (!repoName) {
      throw new Error('No repoName found on the configuration file.')
    }

    if (!githubToken) {
      throw new Error('No GITHUB_TOKEN found on environment variables.')
    }

    const userInfo = getExecuteUserInfo(user, config.users)

    if (!userInfo.hasOwnProperty('github')) {
      throw new Error('Not permitted to execute the issue creator command.')
    }


    const options = {
      headers: {
        'user-agent': `issue-creator v${version}`
      }
    }

    if (baseUrl) {
      options.baseUrl = config.github.baseUrl
    }

    const octokit = new Octokit(options)

    octokit.authenticate({
      type: 'token',
      token: githubToken
    })

    if (!commandText) {
      throw new Error('Invalid the issue title.')
    }

    const result = await octokit.issues.create({
      owner: repoOwner,
      repo: repoName,
      title: commandText,
      assignee: userInfo.github
    })

    const body = {
      'response_type': 'in_channel',
      'attachments': [
        {
          'fallback': `created a new issue in ${repoOwner}/${repoName}`,
          'pretext': `<@${user}> created a new issue in ${repoOwner}/${repoName}.`,
          'title': `Issue #${result.data.number}: ${result.data.title}`,
          'title_link': result.data.html_url,
          'color': 'good',
          'actions': [
            {
              'type': 'button',
              'text': 'Open this issue',
              'url': result.data.html_url,
              'style': 'primary'
            }
          ]
        }
      ]
    }

    return createResponse(200, body)
  } catch (error) {
    console.log(error)
    const body = {
      'attachments': [
        {
          'fallback': `Error: ${error.message}`,
          'color': 'danger',
          'pretext': 'Failed to create a new issue.',
          'text': `Error: ${error.message}`
        }
      ]
    }

    return createResponse(500, body)
  }
}