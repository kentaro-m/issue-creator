jest.mock('@octokit/rest')

const Octokit = require('@octokit/rest')
const { handler } = require('../src/index')
const { createIssue } = require('../src/handler')

describe('handler', () => {
  test('responds with the status code 200 if completes the process', async () => {
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
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await handler(event)

    expect(response.statusCode).toEqual(200)

    process.env.GITHUB_TOKEN = ''
  })

  test('responds with the status code 500 if throws an error', async () => {
    process.env.GITHUB_TOKEN = ''

    Octokit.mockImplementation(() => ({
      authenticate: jest.fn().mockImplementation(async () => {
        throw new Error('Bad credentials')
      })
    }))

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await handler(event)

    expect(response.statusCode).toEqual(500)
  })
})

describe('createIssue', () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'githubToken'
  })

  test('creates a message to notify Slack', async () => {
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

    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

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
  })

  test('sets a base url if uses on the GitHub Enterprise', async () => {
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

    const AppConfig = {
      'github': {
        'baseUrl': 'https://githubenterprise.com/api/v3',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(200)
    expect(Octokit.mock.calls[2][0].baseUrl).toEqual('https://githubenterprise.com/api/v3')

  })

  test('throws an error if repoOwner is not set', async () => {
    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': '',
        'repoName': 'idea'
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: No repoOwner found on the configuration file.')
  })

  test('throws an error if repoName is not set', async () => {
    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': ''
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: No repoName found on the configuration file.')
  })

  test('throws an error if GITHUB_TOKEN is not set', async () => {
    process.env.GITHUB_TOKEN = ''

    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: No GITHUB_TOKEN found on environment variables.')
  })

  test('throws an error if a users key is not exist', async () => {
    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      }
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: users is not iterable')
  })

  test('throws an error if a users list is not set', async () => {
    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      },
      'users': []
    }

    const event = {
      'body': 'user_name=kentaro&text=test+issue'
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: Not permitted to execute the issue creator command.')
  })

  test('throws an error if an issue title is not set', async () => {
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

    const AppConfig = {
      'github': {
        'baseUrl': '',
        'repoOwner': 'kentaro-m',
        'repoName': 'idea'
      },
      'users': [
        {
          'slack': 'john',
          'github': 'john'
        },
        {
          'slack': 'debra',
          'github': 'debra'
        },
        {
          'slack': 'kentaro',
          'github': 'kentaro-m'
        }
      ]
    }

    const event = {
      'body': 'user_name=kentaro&text='
    }

    const response = await createIssue(event, AppConfig)

    expect(response.statusCode).toEqual(500)
    expect(JSON.parse(response.body).attachments[0].text).toEqual('Error: Invalid the issue title.')
  })
})
