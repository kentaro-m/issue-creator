const Octokit = require('@octokit/rest')

class Issue {
  constructor (options) {
    this.octokit = new Octokit(options.octokitOptions)
    this.octokit.authenticate({
      type: 'token',
      token: options.token
    })
  }

  async create (data) {
    return this.octokit.issues.create(data)
  }

  async getLabels (data) {
    return this.octokit.issues.getLabels(data)
  }
}

module.exports = Issue
