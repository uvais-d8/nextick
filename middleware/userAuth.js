const checksession = (req, res, next) => {
    if (!req.session.userId) {
      res.redirect("/login"); 
    } else {
     next();

    }
  };
  const islogin = (req, res, next) => {
    if (req.session.userId) {
      res.redirect("/home");
    } else {
      next()
    }
  };
  
  module.exports ={ 
      checksession,
      islogin
  };
  