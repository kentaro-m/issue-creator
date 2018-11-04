jest.mock('@octokit/rest')

const Octokit = require('@octokit/rest')
const index = require('../src/index')

describe('handler', () => {
  test('responds with the status code 200', async () => {
    process.env.GITHUB_TOKEN = 'githubToken'

    Octokit.mockImplementation(() => ({
      authenticate: jest.fn(),
      issues: {
        create: jest.fn().mockImplementation(async () => {
          return {
            data: {
              number: 1234,
              title: 'Found a bug',
              html_url: 'https://github.com/kentaro-m/issue-creator/issues/1234'
            }
          }
        })
      }
    }))

    const event = {
      "body": 'user_name=kentaro&text=test+issue'
    }

    const response = await index.handler(event)

    expect(response.statusCode).toEqual(200)

    process.env.GITHUB_TOKEN = ''
  })

  test('creates a message to notify Slack', async () => {
    process.env.GITHUB_TOKEN = 'githubToken'

    Octokit.mockImplementation(() => ({
      authenticate: jest.fn(),
      issues: {
        create: jest.fn().mockImplementation(async () => {
          return {
            data: {
              number: 1234,
              title: 'Found a bug',
              html_url: 'https://github.com/kentaro-m/issue-creator/issues/1234'
            }
          }
        })
      }
    }))

    const event = {
      "body": 'user_name=kentaro&text=test+issue'
    }

    const response = await index.handler(event)

    expect(response.statusCode).toEqual(200)
    expect(JSON.parse(response.body)).toEqual({
      'response_type': 'in_channel',
      'attachments': [
        {
          'fallback': `created a new issue in kentaro-m/idea`,
          'pretext': `<@kentaro> created a new issue in kentaro-m/idea.`,
          'title': `Issue #1234: Found a bug`,
          'title_link': 'https://github.com/kentaro-m/issue-creator/issues/1234',
          'color': 'good',
          'actions': [
            {
              'type': 'button',
              'text': 'Open this issue',
              'url': 'https://github.com/kentaro-m/issue-creator/issues/1234',
              'style': 'primary'
            }
          ]
        }
      ]
    })

    process.env.GITHUB_TOKEN = ''
  })

  test('responds with the status code 500 if GITHUB_TOKEN is not set', async () => {
    process.env.GITHUB_TOKEN = ''

    Octokit.mockImplementation(() => ({
      authenticate: jest.fn().mockImplementation(async () => {
        throw new Error('Bad credentials')
      })
    }))

    const event = {
      "body": 'user_name=kentaro&text=test+issue'
    }

    const response = await index.handler(event)

    expect(response.statusCode).toEqual(500)
  })
})