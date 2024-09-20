/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const githubApp = require('../../node_modules/github-app');
jest.mock('../../node_modules/github-app');
const openWhisk = require('openwhisk');
jest.mock('openwhisk');

const checker = require('../../checker/checker.js');

describe('checker action', function () {
  afterEach(() => {
    githubApp.mockReset();
    openWhisk.mockReset();
    jest.restoreAllMocks();
  });
  describe('ignored events', function () {
    it('should return 202 if no pull_request property exists', async function () {
      const params = {};
      const result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
    });
    it('should return 202 if pull_request property exists but action is "review_requested" or "edited"', async function () {
      const params = { pull_request: { blah: true }, action: 'review_requested' };
      let result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
      params.action = 'edited';
      result = await checker.main(params);
      expect(result.statusCode).toBe(202);
      expect(result.body).toContain('Not a pull request');
    });
  });
  describe('happy path (setting some manner of useful github check to the user)', function () {
    it('should proceed with processing webhook events like pr opened, reopened and synchronize', async function () {
      const events = ['opened', 'reopened', 'synchronize'];
      const params = events.map(function (event) {
        return {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: event,
          installation: { id: '5431' }
        };
      });
      githubApp.mockImplementation(() => {
        return {
          asInstallation: async () => {
            return {
              checks: {
                create: async (options) => {
                  return { title: 'foo' };
                }
              },
              orgs: {
                checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                checkPublicMembership: jest.fn()
              }
            };
          }
        };
      });
      openWhisk.mockImplementation(() => {
        return {
          actions: {
            invoke: jest.fn().mockImplementationOnce((args) => {
              return {
                title: args.params.title
              };
            })
          }
        };
      });
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, access_token: 'yes', text: () => 'Custom Field 8\nsteve' });
      await Promise.all(params.map(async function (param) {
        const result = await checker.main(param);
        expect(result.statusCode).toBe(200);
      }));
    });
    it('should invoke the setgithubcheck action with a status of completed if user is a bot', async function () {
      const params = {
        pull_request: {
          user: { login: 'greenkeeper', type: 'Bot' },
          base: {
            repo: {
              owner: { login: 'adobe' },
              name: 'photoshop'
            }
          },
          head: { sha: '12345' }
        },
        action: 'opened',
        installation: { id: '5431' }
      };
      githubApp.mockImplementation(() => {
        return {
          asInstallation: async () => {
            return {
              checks: {
                create: async (options) => {
                  return { title: 'foo' };
                }
              },
              orgs: {
                checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                checkPublicMembership: jest.fn()
              }
            };
          }
        };
      });
      const invoke_spy = jest.fn().mockImplementationOnce((args) => {
        return {
          title: args.params.title
        };
      });
      openWhisk.mockImplementation(() => {
        return {
          actions: {
            invoke: invoke_spy
          }
        };
      });
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, access_token: 'yes', text: () => 'Custom Field 8\nsteve' });
      const response = await checker.main(params);
      const action_invoke_args = invoke_spy.mock.calls[0][0];
      expect(action_invoke_args.name).toBe('cla-setgithubcheck');
      expect(action_invoke_args.params.status).toBe('completed');
      expect(action_invoke_args.params.title).toContain('Bot');
      expect(response.statusCode).toBe(200);
    });
    describe('for PRs issued to the magento github organization', () => {
      it('should invoke the setgithubcheck action with a status of completed if user has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                  checkPublicMembership: jest.fn()
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce((args) => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        }).mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockImplementation(async (args) => {
            return { ok: true, status: 200, access_token: 'yes', json: async () => ({ access_token: 200 }) };
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: () => ({
              userAgreementList: [
                { status: 'SIGNED', name: 'Adobe Contributor License Agreement' }
              ],
              access_token: 200
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[1][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });

      it(`should invoke the setgithubcheck action with a conclusion of action_required if user no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                  checkPublicMembership: jest.fn()
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce((args) => {
          return {
            body: {
              usernames: []
            }
          };
        }).mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: () => ({
              userAgreementList: [
                { status: 'SIGNED', name: 'Adobe Contributor License Agreement' }
              ],
              access_token: 200
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[1][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a conclusion of action_required if zero signed CLAs exist', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'magento' },
                name: 'magento2'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                  checkPublicMembership: jest.fn()
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: () => ({
              userAgreementList: [],
              access_token: 200
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[0][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
    describe('for PRs issued to the adobe github organization', () => {
      it('should invoke the setgithubcheck action with a status of completed if user is a member of the adobe org', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        githubApp.mockImplementationOnce(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockResolvedValueOnce({ status: 204 }),
                  checkPublicMembership: jest.fn()
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[0][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
        expect(response.statusCode).toBe(200);
      });

      it('should invoke the setgithubcheck action with a status of completed if user is not a member of the adobe org but has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    return { status: 204 };
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        }).mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: async () => ({
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }],
              access_token: 200
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[1][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });

      it(`should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the adobe org and no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    return { status: 204 };
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: async () => ({
              // no agreements found
              userAgreementList: null,
              access_token: 404
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[0][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });

      it('should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of the adobe org and zero signed CLAs exist', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobe' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    return { status: 204 };
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: async () => ({
              // no agreements found
              userAgreementList: [],
              access_token: 404
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[0][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
    describe('for PRs issued to orgs that are not github.com/adobe, but are adobe-adjacent', function () {
      it('should invoke the setgithubcheck action with a status of completed if user is NOT a member of org the PR is issued on but is a member of the adobe org', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };
        // Have the first github org check (within org) fail, but the second one
        // (in the adobe org) succeed

        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    return { status: 204 };
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[0][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('Adobe Employee');
        expect(response.statusCode).toBe(200);
      });
      it('should invoke the setgithubcheck action with a status of completed if user is not a member of org the PR was issued on and not a public member of github.com/adobe org but has signed a cla', async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }

        class CustomErrorNotPublic {
          code = 404;
          message = 'is not a public member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomErrorNotPublic();
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['hiren']
            }
          };
        }).mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: async () => ({
              // no agreements found
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }],
              access_token: 204
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[1][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.status).toBe('completed');
        expect(action_invoke_args.params.title).toContain('CLA Signed');
        expect(response.statusCode).toBe(200);
      });

      it(`should invoke the setgithubcheck action with a conclusion of action_required if user is not a member of org the PR was issued on, not a public member of github.com/adobe and no agreements are found containing the user's github username`, async function () {
        const params = {
          pull_request: {
            user: { login: 'hiren' },
            base: {
              repo: {
                owner: { login: 'adobedocs' },
                name: 'photoshop'
              }
            },
            head: { sha: '12345' }
          },
          action: 'opened',
          installation: { id: '5431' }
        };

        class CustomError {
          code = 404;
          message = 'is not a member of the org';
        }

        class CustomErrorNotPublic {
          code = 404;
          message = 'is not a public member of the org';
        }
        githubApp.mockImplementation(() => {
          return {
            asInstallation: async () => {
              return {
                checks: {
                  create: async (options) => {
                    return { title: 'foo' };
                  }
                },
                orgs: {
                  checkMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomError();
                  }),
                  checkPublicMembership: jest.fn().mockImplementationOnce(() => {
                    throw new CustomErrorNotPublic();
                  })
                }
              };
            }
          };
        });
        const invoke_spy = jest.fn().mockImplementationOnce(() => {
          return {
            body: {
              usernames: ['sam']
            }
          };
        }).mockImplementationOnce((args) => {
          return {
            title: args.params.title
          };
        });
        openWhisk.mockImplementation(() => {
          return {
            actions: {
              invoke: invoke_spy
            }
          };
        });
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, status: 200, access_token: 'yes', json: () => ({ access_token: 200 }) })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            access_token: 'yes',
            json: async () => ({
              // no agreements found
              userAgreementList: [{
                status: 'SIGNED',
                name: 'Adobe CLA',
                agreementId: '123'
              }],
              access_token: 204
            })
          });
        const response = await checker.main(params);
        const action_invoke_args = invoke_spy.mock.calls[1][0];
        expect(action_invoke_args.name).toBe('cla-setgithubcheck');
        expect(action_invoke_args.params.conclusion).toBe('action_required');
        expect(action_invoke_args.params.title).toContain('Sign the Adobe CLA');
        expect(response.statusCode).toBe(200);
      });
    });
  });
  describe('merge queue', function () {
    it('should pass the PR through the merge queue because the CLA would have already been found', async function () {
      const params = {
        merge_group: {
          head_sha: '12345'
        },
        repository: {
          owner: {
            login: 'adobe'
          },
          name: 'photoshop'
        },
        action: 'checks_requested'
      };

      const invoke_spy = jest.fn().mockImplementationOnce((args) => {
        return {
          title: args.params.title
        };
      });
      openWhisk.mockImplementation(() => {
        return {
          actions: {
            invoke: invoke_spy
          }
        };
      });
      const response = await checker.main(params);
      const action_invoke_args = invoke_spy.mock.calls[0][0];
      expect(action_invoke_args.name).toBe('cla-setgithubcheck');
      expect(action_invoke_args.params.conclusion).toBe('success');
      expect(action_invoke_args.params.title).toContain('CLA Signed');
      expect(response.statusCode).toBe(200);
    });
  });
});
