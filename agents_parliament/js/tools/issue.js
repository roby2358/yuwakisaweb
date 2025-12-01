/**
 * parliament-issue tool - Manage issues/tasks
 */
export function toolIssue(session, args) {
    const action = args[0];

    if (action === 'create') {
        const title = args[1].replace(/"/g, '');
        const description = args.slice(2).join(' ').replace(/"/g, '');

        const issue = {
            id: `ISSUE-${session.nextIssueId++}`,
            title,
            description,
            status: 'open',
            created: new Date().toISOString()
        };

        session.issues.push(issue);

        return {
            status: 'success',
            message: `Issue ${issue.id} created`,
            data: issue,
            exitCode: 0
        };
    } else if (action === 'close') {
        const issueId = args[1];
        const issue = session.issues.find(i => i.id === issueId);

        if (!issue) {
            return { status: 'error', message: 'Issue not found', exitCode: 4 };
        }

        issue.status = 'closed';
        issue.closed = new Date().toISOString();

        return {
            status: 'success',
            message: `Issue ${issueId} closed`,
            data: issue,
            exitCode: 0
        };
    } else if (action === 'list') {
        const openIssues = session.issues.filter(i => i.status === 'open');
        return {
            status: 'success',
            message: 'Open issues',
            data: { issues: openIssues },
            exitCode: 0
        };
    }

    return { status: 'error', message: 'Invalid action', exitCode: 1 };
}

