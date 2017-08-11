
(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() { // generic error catching
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
       if (smart.hasOwnProperty('smart_style_url')) {
          $.get(smart.smart_style_url, function(data) {
              var style = data;
              console.log(data);
          });
      }
      
      if (smart.hasOwnProperty('patient')) {//if a patient is being handed to the program, do all of the following...

        var userId = smart.userId;
        smart.userId = userId.slice(smart.server.serviceUrl.length + 1);
        var u = smart.user.read();
        console.log(u);
        console.log(smart.userId);
        
        var patient = smart.patient; //stores patient context
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({//where the patient API's/FHIR resources can be fetched and stored
                    type: 'Observation',//FHIR resource Observation
                    query: {
                      code: {//LOIC codes
                        $or: ['http://loinc.org|8302-2', //for height
                              'http://loinc.org|8462-4', //for diastolic bp
                              'http://loinc.org|8480-6', //for systolic bp
                              'http://loinc.org|2085-9', //for hdl
                              'http://loinc.org|2089-1', //for ldl
                              'http://loinc.org|55284-4', //generic bp code
                              'http://loinc.org|18810-2']//(Akeem's experiment)last code for EKG
                      }
                    }
                  });

        $.when(pt, obv).fail(onError); //for error catching

        $.when(pt, obv).done(function(patient, obv) { //when patient/his or her tests have been fetched
          var byCodes = smart.byCodes(obv, 'code'); 
          var gender = patient.gender; //patient gender
          var dob = new Date(patient.birthDate); //patient DOB
          var day = dob.getDate(); //gets date from DOB
          var monthIndex = dob.getMonth() + 1; //gets month
          var year = dob.getFullYear(); //gets year

          var dobStr = monthIndex + '/' + day + '/' + year; //formatting for DOB
          var fname = ''; //variable holders for first and last name of patient
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }
          
          var mrn = patient.identifier[0].value;

          var height = byCodes('8302-2'); //getting height using method "byCodes", with LOINC code being used as input 
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');//getting bps...
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');//getting hdl
          var ldl = byCodes('2089-1');//getting ldl

          var EKG = byCodes('18810-2'); //(experimenting) EKG value

          var systolicbpDate = byCodes('55284-4').effectiveDateTime; // (experimenting) trying to access date of systolicbp test

          var p = defaultPatient(); //variable that will be used to hold all patient information extracted



          p.birthdate = dobStr; //patient p's DOB string being placed instance variable birthdate
          p.gender = gender; //p's gender being put in variable gender
          p.fname = fname; //fname being placed in p's instance variable fname
          p.lname = lname;//lname being placed in p's instance variable lname
          p.mrn = mrn;
          p.age = parseInt(calculateAge(dob)); //the same applies to the age...
          p.height = getQuantityValueAndUnit(height[0]);//the same applies to the height

          p.EKG = EKG;//(experimenting) EKG VALUE
          if (typeof EKG != 'undefined'){ //if EKG exists, put in patient's EKG variable
            p.EKG = EKG;
          }
          else
            p.EKG = "EKG doesn't exist"; //else, save as nonexistent


          if (typeof systolicbpDate != 'undefined'){ //if systolic date exists
            p.systolicbpDate = 'systolicbpDate exists'; //save as "exists"
          }
          else
            p.systolicbpDate = 'doesn"t exist'; //"save as DNE"


          if (typeof systolicbp != 'undefined')  { //if systolic exists, save value in p's systolicbp variable
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') { //if diastolic exists, save value in p's diastolicbp variable
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]); //get hdl value and unit
          p.ldl = getQuantityValueAndUnit(ldl[0]); //get ldl value and unit

          ret.resolve(p);
        });
      } else {//else if no patient is being handed to the program, run onError method...
        onError(); 
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){ //holds the "instance variables" of p
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      mrn: {value: ''},
      birthdate: {value: ''},
      age: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},

      EKG: {value: ''},//EKG (test)
      systolicbpDate: {value: ''},//systolic bp date (test)
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) { //function that gets bp from inputs
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function isLeapYear(year) { //function that tells if it's a leapyear
    return new Date(year, 1, 29).getMonth() === 1;
  }

  function calculateAge(date) { //function that calculates age of patient given DOB
    if (Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime())) {
      var d = new Date(date), now = new Date();
      var years = now.getFullYear() - d.getFullYear();
      d.setFullYear(d.getFullYear() + years);
      if (d > now) {
        years--;
        d.setFullYear(d.getFullYear() - 1);
      }
      var days = (now.getTime() - d.getTime()) / (3600 * 24 * 1000);
      return years + days / (isLeapYear(now.getFullYear()) ? 366 : 365);
    }
    else {
      return undefined;
    }
  }

  function getQuantityValueAndUnit(ob) { //gives valueQuantity of a test
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }

  window.drawVisualization = function(p) {  
  //draws out the final visualization on the
  //webpage UI... substitutes HTML tags (#____) for p's instance 
  //variables stored in patient context "p"
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#mrn').html(p.mrn);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    //$('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);

    $('#EKG').html(p.EKG);//EKG

  };

})(window);
