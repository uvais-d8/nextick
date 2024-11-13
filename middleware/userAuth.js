const checksession = (req, res, next) => {
    if (!req.session.userId) {
      next();
    } else {
      res.redirect("/user/login");
    }
  };
  const islogin = (req, res, next) => {
    if (req.session.userId) {
      res.redirect("/user/home");
    } else {
      next()
    }
  };
  
  module.exports ={ 
      checksession,
      islogin
  };
  