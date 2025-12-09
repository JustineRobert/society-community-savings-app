// controllers/loanController.js
const Loan = require('../models/Loan');

exports.requestLoan = async (req, res) => {
    const { groupId, amount } = req.body;
    try {
        const loan = new Loan({
            user: req.user.id,
            group: groupId,
            amount,
        });
        await loan.save();
        res.status(201).json(loan);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getUserLoans = async (req, res) => {
    try {
        const loans = await Loan.find({ user: req.user.id })
            .populate('group', 'name')
            .sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getGroupLoans = async (req, res) => {
    try {
        const loans = await Loan.find({ group: req.params.groupId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.updateLoanStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const loan = await Loan.findById(req.params.loanId);
        if (!loan) return res.status(404).json({ msg: 'Loan not found' });

        loan.status = status;
        await loan.save();
        res.json(loan);
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};
