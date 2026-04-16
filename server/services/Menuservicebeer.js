const Menumodelbeer = require('../models/Menumodelbeer');

exports.fetchmenubar = async (itemCode, subCategory) => {
    return await Menumodelbeer.getInventory(itemCode, subCategory);
};


exports.fetchmocktail = async (itemcode) => {
    return await Menumodelbeer.fetchMocktail(itemcode);
};

exports.Snacksveg = async (itemcode, subcategory) => {
    return await Menumodelbeer.Snacksveg(itemcode, subcategory);
}

exports.Snacknonveg = async (itemcode) => {
    return await Menumodelbeer.Snacknonveg(itemcode);
}

exports.Drinkhardbeer = async (itemcode) => {
    return await Menumodelbeer.Drinkhardbeer(itemcode);
}

exports.Drinkhardbrandy = async (itemcode) => {
    return await Menumodelbeer.Drinkhardbrandy(itemcode);
}


exports.Drinkhardbreezer = async (itemcode) => {
    return await Menumodelbeer.Drinkhardbreezer(itemcode);
}
exports.Drinkhardvodka = async (itemcode) => {
    return await Menumodelbeer.Drinkhardvodka(itemcode);
}

exports.DrinkhardGin = async (itemcode) => {
    return await Menumodelbeer.DrinkhardGin(itemcode);
}

exports.DrinkhardRum = async (itemcode) => {
    return await Menumodelbeer.DrinkhardRum(itemcode);
}

exports.DrinkhardWhisky = async (itemcode) => {
    return await Menumodelbeer.DrinkhardWhisky(itemcode);
}

exports.DrinkhardWine = async (itemcode) => {
    return await Menumodelbeer.DrinkhardWine(itemcode);
}

exports.DrinkhardLiquor = async (itemcode) => {
    return await Menumodelbeer.DrinkhardLiquor(itemcode);
}

exports.DrinkhardTequila = async (itemcode) => {
    return await Menumodelbeer.DrinkhardTequila(itemcode);
}
exports.DrinkhardCocktail = async (itemcode) => {
    return await Menumodelbeer.DrinkhardCocktail(itemcode);
}

