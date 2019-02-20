const express = require('express')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const { WebClient } = require('@slack/client')
const signature = require('./verify_signature')
const Issue = require('./issue')
const AppConfig = require('config')
const version = require('../package.json').version

const app = express()

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8')
  }
}

const getExecuteUserInfo = (executeUser, users) => {
  for (const user of users) {
    if (executeUser === user.slack) {
      return user
    }
  }
  return {}
}

app.use(bodyParser.urlencoded({verify: rawBodyBuffer, extended: true }))
app.use(bodyParser.json({ verify: rawBodyBuffer }))
app.use(awsServerlessExpressMiddleware.eventContext())

app.post('/command', async (req, res) => {
  try {
    const {text, trigger_id} = req.body
    const githubToken = process.env.GITHUB_API_TOKEN

    if (signature.isVerified(req)) {
      const issueOptions = {
        token: githubToken,
        octokitOptions: {
          headers: {
            'user-agent': `issue-creator v${version}`
          }
        }
      }

      if (AppConfig.github.baseUrl) {
        issueOptions.octokitOptions.baseUrl = AppConfig.github.baseUrl
      }

      const issue = new Issue(issueOptions)

      const result = await issue.getLabels({
        owner: AppConfig.github.repoOwner,
        repo: AppConfig.github.repoName,
      })

      const labels = result.data.map(label => {
        return {
          label: label.name,
          value: label.name,
        }
      })

      const assignees = AppConfig.users.map(user => {
        return {
          label: user.github,
          value: user.github,
        }
      })

      const slackToken = process.env.SLACK_API_TOKEN
      const web = new WebClient(slackToken)

      const dialog = {
        trigger_id,
        dialog: {
          title: 'Create an issue',
          callback_id: 'create-issue',
          submit_label: 'Create',
          elements: [
            {
              label: 'Title',
              type: 'text',
              name: 'title',
              value: text,
              hint: ''
            },
            {
              label: 'Description',
              type: 'textarea',
              name: 'description',
              optional: true
            },
            {
              label: "Label",
              type: "select",
              name: "label",
              optional: true,
              options: labels
            },
            {
              label: "Assignee",
              type: "select",
              name: "assignee",
              optional: true,
              options: assignees
            }
          ]
        }
      }
      await web.dialog.open(dialog)

      res.send('')
    } else {
      res.sendStatus(500)
    }
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

app.post('/interactive', async (req, res) => {
  try {
    const body = JSON.parse(req.body.payload)
    const githubToken = process.env.GITHUB_API_TOKEN

    if (signature.isVerified(req)) {

      const issueOptions = {
        token: githubToken,
        octokitOptions: {
          headers: {
            'user-agent': `issue-creator v${version}`
          }
        }
      }

      if (AppConfig.github.baseUrl) {
        issueOptions.octokitOptions.baseUrl = AppConfig.github.baseUrl
      }

      const issue = new Issue(issueOptions)

      const executeUserInfo = getExecuteUserInfo(body.user.name, AppConfig.users)

      const issueData = {
        owner: AppConfig.github.repoOwner,
        repo: AppConfig.github.repoName,
        title: body.submission.title,
        assignees: [ body.submission.assignee || executeUserInfo.github ],
        body: body.submission.description,
        labels: [ body.submission.label ]
      }

      const result = await issue.create(issueData)

      const slackToken = process.env.SLACK_API_TOKEN
      const web = new WebClient(slackToken)

      const messageData = {
        channel: body.channel.id,
        attachments: [
          {
            'fallback': `created a new issue in ${AppConfig.github.repoOwner}/${AppConfig.github.repoName}`,
            'pretext': `<@${body.user.name}> created a new issue in ${AppConfig.github.repoOwner}/${AppConfig.github.repoName}.`,
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

      await web.chat.postMessage(messageData)
      res.send('')
    } else {
      res.sendStatus(500)
    }
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

module.exports = app
