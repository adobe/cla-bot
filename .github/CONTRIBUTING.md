# Contributing

Thanks for choosing to contribute!

The following are a set of guidelines to follow when contributing to this project.

## Code Of Conduct

This project adheres to the Adobe [code of conduct](../CODE_OF_CONDUCT.md). By participating,
you are expected to uphold this code. Please report unacceptable behavior to
[Grp-opensourceoffice@adobe.com](mailto:Grp-opensourceoffice@adobe.com).

## Have A Question?

Start by filing an issue. The existing committers on this project work to reach
consensus around project direction and issue solutions within issue threads
(when appropriate).

## Contributor License Agreement

All third-party contributions to this project must be accompanied by a signed contributor
license agreement. This gives Adobe permission to redistribute your contributions
as part of the project. [Sign our CLA](http://opensource.adobe.com/cla.html). You
only need to submit an Adobe CLA one time, so if you have submitted one previously,
you are good to go!

## Code Reviews

All submissions should come in the form of pull requests and need to be reviewed
by project committers. Read [GitHub's pull request documentation](https://help.github.com/articles/about-pull-requests/)
for more information on sending pull requests.

## Testing

### Unit tests

Unit tests are used to test individual modules of the code in isolation with API calls
and other external services mocked out. Unit tests should pass in local development and any CI builds.
New features should be accompanied by unit tests.

### Integration tests

Integration tests are used to test the application's interaction with GitHub by performing real API calls
to create branches, files and PRs and asserting that the checker works correctly.
Integration tests require the following [personal access tokens](https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line) to be set as environment variables:
- TEST_ONE_PAC: PAC for account adobeiotest1. Adobe ICLA signed. not a member of any orgs.
- TEST_TWO_PAC: PAC for account adobeiotest2. Adobe CCLA signed. not a member of any orgs.
- TEST_FOUR_PAC: PAC for account adobeiotest4. Adobe CCLA signed. member of the adobe org and magento org (and part of magento-employees team).
- TEST_MAJ_PAC: PAC for account majtest. no CLA signed. not a member of any orgs.
added as a _collaborator_ on magento/devops-cla-test and magento/devops-cla-test-adcb
- TEST_MAJ583_PAC: PAC for account majtest583. no CLA signed. member of magento and the community-contributors team.
The integration tests will fail unless all the above tokens are provided. Since the tokens are sensitve secrets,
only CI builds in the main repo at [adobe/cla-bot](https://github.com/adobe/cla-bot) are configured with the tokens.
It is expected that integration tests on CI builds in forked repos will fail. Once your PR has been approved,
your changes will be pushed to a new branch on the main repo for a full CI pass before being merged into master.

## From Contributor To Committer

We love contributions from our community! If you'd like to go a step beyond contributor
and become a committer with full write access and a say in the project, you must
be invited to the project. The existing committers employ an internal nomination
process that must reach lazy consensus (silence is approval) before invitations
are issued. If you feel you are qualified and want to get more deeply involved,
feel free to reach out to existing committers to have a conversation about that.

## Security Issues

Security issues shouldn't be reported on this issue tracker. Instead, [file an issue to our security experts](https://helpx.adobe.com/security/alertus.html)
