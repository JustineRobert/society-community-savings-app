// models/GroupWallet.js
module.exports = (sequelize, DataTypes) => {
  const GroupWallet = sequelize.define("GroupWallet", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    saccoId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
  }, { timestamps: true });
  return GroupWallet;
};
