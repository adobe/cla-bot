---
name: Signed CLA not detected
about: Issue template and instructions for mitigating CLA bot issues
title: "[CLA check failure]"
labels: ''
assignees: josh-hadley

---

**BEFORE PROCEEDING WITH FILING AN ISSUE**

There are occasional network hiccups that can cause the CLA bot check to fail. However, this is extremely rare and usually very transient (check https://www.githubstatus.com/ and look for anomalies in "webhooks"). The **MOST COMMON** cause of CLA bot failing to verify is _incorrect data in the CLA form_. Before reporting a CLA bot failure, ensure the following:
 - you have the correct GitHub username (with no "@" in front, no 'https://github.com', just the plain username, not email) in the GitHub Login field (for example, if I were filling out the form, I'd put `josh-hadley` into that field and _nothing else_).
 - you have your full, correct, primary email associated with your GitHub account in the email field (for example, `user@organization.com` and _nothing else_).

Once you have submitted an updated form with the correct information: close, then re-open any PRs that failed the check. This will re-trigger the CLA bot check and should pass once the correct information is filled in.

Only if you are 100% certain that you've filled out the form correctly, continue to submit an issue and someone will investigate. _Please supply a link to the Pull Request where the CLA check fails._
