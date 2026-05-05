const Pubmenubuymodel = require('../models/Pubmenubuymodel');

const Pubmenubuyservice = async (ORDER_NUMBER) => {
    return await Pubmenubuymodel.Pubmenubuymodel(ORDER_NUMBER);
};

module.exports = {
    Pubmenubuyservice,
};
