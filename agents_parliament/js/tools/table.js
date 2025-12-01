/**
 * parliament-table tool - Submit Bills, Motions, Amendments, or Papers
 */
export function toolTable(session, args) {
    const type = args[0];

    if (type === 'bill') {
        const filename = args[1];
        const description = args.slice(2).join(' ').replace(/"/g, '');

        const bill = {
            id: `BILL-${String(session.nextBillId++).padStart(2, '0')}`,
            type: 'bill',
            target: filename,
            description,
            stage: 'First Reading',
            created: new Date().toISOString()
        };

        session.bills.push(bill);
        session.state.currentBill = bill.id;

        return {
            status: 'success',
            message: `Bill ${bill.id} tabled`,
            data: bill,
            exitCode: 0
        };
    } else if (type === 'paper') {
        const filename = args[1];
        const description = args.slice(2).join(' ').replace(/"/g, '');

        const paper = {
            id: `PAPER-${session.papers.length + 1}`,
            filename,
            description,
            content: session.files[filename] || '[File not found]'
        };

        session.papers.push(paper);

        return {
            status: 'success',
            message: `Paper tabled: ${filename}`,
            data: paper,
            exitCode: 0
        };
    } else if (type === 'amendment') {
        const amendmentId = args[1];
        const description = args.slice(2).join(' ').replace(/"/g, '');

        const amendment = session.amendments.find(a => a.id === amendmentId);
        if (!amendment) {
            return { status: 'error', message: 'Amendment not found', exitCode: 4 };
        }

        amendment.tabled = true;
        amendment.description = description;
        session.state.activeMotion = `That Amendment ${amendmentId} be made`;

        return {
            status: 'success',
            message: `Amendment ${amendmentId} tabled`,
            data: amendment,
            exitCode: 0
        };
    }

    return { status: 'error', message: 'Invalid type', exitCode: 1 };
}

