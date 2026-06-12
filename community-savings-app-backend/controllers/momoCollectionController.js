// Request to Pay (Deposit) (controllers/momoCollectionController.js)

const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Transaction = require("../models/Transaction");
const { getMomoToken } = require("../services/momoTokenService");

exports.requestToPay = async (req, res) => {
  try {
    const token = await getMomoToken();
    const referenceId = uuidv4();

    await Transaction.create({
      userId: req.user.id,
      type: "DEPOSIT",
      amount: req.body.amount,
      phone: req.body.phone,
      externalId: referenceId
    });

    await axios.post(
      `${process.env.MOMO_BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: req.body.amount,
        currency: "UGX",
        externalId: referenceId,
        payer: { partyIdType: "MSISDN", partyId: req.body.phone },
        payerMessage: "Deposit",
        payeeNote: "Savings deposit"
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Reference-Id": referenceId,
          "X-Target-Environment": process.env.MOMO_ENV,
          "Ocp-Apim-Subscription-Key":
            process.env.COLLECTION_SUBSCRIPTION_KEY
        }
      }
    );

    res.json({ referenceId, status: "PENDING" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
