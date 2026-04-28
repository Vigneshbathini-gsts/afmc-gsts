const Menuservicebeer = require('../services/Menuservicebeer');

exports.getInventory = async (req,res) => {
    try {
        const { itemCode, subCategory } = req.query;
        
        const data = await Menuservicebeer.fetchmenubar(
            itemCode || null,
            subCategory || null
        );

        res.status(200).json({
            success: true,
            data
        })
        
    } catch(error) {
        console.log("error", error);
        res.status(500).json({
            success: false,
            message: "server error"
        });
    }
}


exports.fetchmenubar = async (req, res) => {
    try {
         const { itemcode } = req.query;
    const data = await Menuservicebeer.fetchmocktail(itemcode || null);
    res.status(200).json({
        message: "data sent",
        data
    })
            
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.Snacksveg = async (req,res) => {
    try {
        const { itemcode, subcategory } = req.query;
        const data = await Menuservicebeer.Snacksveg(
            itemcode || null,
            subcategory || null);
        res.status(200).json({
            message: "data",
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}




exports.Stacknonveg = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.Snacknonveg(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.Drinkhardbeer = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.Drinkhardbeer(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.Drinkhardbrandy = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.Drinkhardbrandy(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.Drinkhardbreezer = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.Drinkhardbreezer(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}

exports.Drinkhardvodka = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.Drinkhardvodka(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.DrinkhardGin = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardGin(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.DrinkhardRum = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardRum(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.DrinkhardWhisky = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardWhisky(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}

exports.DrinkhardWine = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardWine(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}



exports.DrinkhardLiquor = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardLiquor(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}



exports.DrinkhardTequila = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardTequila(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}


exports.DrinkhardCocktail = async (req, res) => {
    try {
        const { itemcode } = req.query;
        const data = await Menuservicebeer.DrinkhardCocktail(itemcode || null);

        res.status(200).json({
            success: true,
            data
        })
        
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message : "server error"
        })
    }
}