;(function ($) {
  'use strict'
  var localStorage = window.localStorage

  // Initialize Firebase
  var firebase = window.firebase
  var config = {
    apiKey: 'AIzaSyD4F0OytuvLoaDQNWo5_7NhESLO7NQW5ow',
    authDomain: 'tab-notes-aeec0.firebaseapp.com',
    databaseURL: 'https://tab-notes-aeec0.firebaseio.com',
    storageBucket: 'tab-notes-aeec0.appspot.com',
    messagingSenderId: '274661172648'
  }
  firebase.initializeApp(config)
  var database = firebase.database()

  var changed = -1
  var syncSource = null

  function getInitialValue () {
    var initialValue = `# Welcome to Tab-Notes

  Trained to understand Markdown, Tab-Notes will keep your:

  - thoughts
  - to-dos
  - memos

  __Always ready for you!__

  Based on http://simplemde.com/, with my personal set of improvements, it will help you be more organized.

  - [x] Read introduction
  - [ ] Click on a to-do to mark is as done
  - [ ] Be more productive
    `

    var localContent = localStorage.getItem('content')
    var localChanged = localStorage.getItem('changed')

    if (localContent && localChanged) {
      initialValue = localContent
      changed = localChanged
    }
    return initialValue
  }

  var simplemde = new window.SimpleMDE({
    'initialValue': getInitialValue(),
    'placeholder': 'Seems like there is nothing noted!',
    'shortcuts': {
      'drawImage': null,
      'drawLink': null,
      'togglePreview': 'Cmd-Alt-P'
    },
    'status': false,
    'spellChecker': false,
    'toolbar': false
  })
  var saveToFirebaseTimerId
  simplemde.codemirror.on('changes', function () {
    var content = simplemde.value()
    var user = firebase.auth().currentUser

    if (!syncSource) {
      changed = +new Date()
    }

    if (syncSource !== 'firebase' && user) {
      clearTimeout(saveToFirebaseTimerId)
      saveToFirebaseTimerId = setTimeout(function () {
        database.ref('users/' + user.uid + '/note').set({
          'content': content,
          'changed': changed
        })
      }, 2000)
    }
    localStorage.setItem('content', content)
    localStorage.setItem('changed', changed)
    syncSource = null
  })
  simplemde.codemirror.on('renderLine', function (cm, line, element) {
    var styles = line.styles.toString()
    if (styles.search('formatting-task') >= 0) {
      $(element).addClass('task')
      if (styles.search('property') >= 0) {
        $(element).addClass('task-completed')
      }
    }
  })
  simplemde.codemirror.on('focus', function (cm, event) {
    var user = firebase.auth().currentUser
    if (user) {
      database.ref('users/' + user.uid + '/note').once('value').then(function (snapshot) {
        var values = snapshot.val()
        if (parseInt(values.changed, 10) > parseInt(changed, 10)) {
          syncSource = 'firebase'
          changed = values.changed
          cm.setValue(values.content)
        }
      })
    }
    if (parseInt(localStorage.getItem('changed'), 10) > parseInt(changed, 10)) {
      syncSource = 'localStorage'
      changed = localStorage.getItem('changed')
      cm.setValue(localStorage.getItem('content'))
    }
  })
  simplemde.codemirror.on('mousedown', function (cm, event) {
    if ($(event.target).siblings('.cm-formatting-task').length > 0 || $(event.target).hasClass('cm-formatting-task')) {
      event.preventDefault()
      var element = $(event.target).parent().children('.cm-formatting-task')[0]
      var line = cm.getLineHandle($(element).parents('.CodeMirror-line').index())
      if (element.className.search('cm-property') >= 0) {
        line.text = line.text.replace('[x]', '[ ]')
      } else {
        line.text = line.text.replace('[ ]', '[x]')
      }
      var lineNo = line.lineNo()
      var position = line.text.length
      cm.setValue(cm.getValue())
      cm.focus()
      cm.setCursor(lineNo, position)
    }
  })

  /**
   * Handles the sign in button press.
   */
  function toggleSignIn () {
    if (firebase.auth().currentUser) {
      // [START signout]
      firebase.auth().signOut()
    // [END signout]
    } else {
      var email = document.getElementById('email').value
      var password = document.getElementById('password').value
      if (email.length < 4) {
        window.alert('Please enter an email address.')
        return
      }
      if (password.length < 4) {
        window.alert('Please enter a password.')
        return
      }
      // Sign in with email and pass.
      // [START authwithemail]
      firebase.auth().signInWithEmailAndPassword(email, password).catch(function (error) {
        // Handle Errors here.
        var errorCode = error.code
        var errorMessage = error.message
        // [START_EXCLUDE]
        if (errorCode === 'auth/wrong-password') {
          window.alert('Wrong password.')
        } else {
          window.alert(errorMessage)
        }
        console.log(error)
        document.getElementById('quickstart-sign-in').disabled = false
      // [END_EXCLUDE]
      })
    // [END authwithemail]
    }
    document.getElementById('quickstart-sign-in').disabled = true
  }

  /**
   * Handles the sign up button press.
   */
  function handleSignUp () {
    var email = document.getElementById('email').value
    var password = document.getElementById('password').value
    if (email.length < 4) {
      window.alert('Please enter an email address.')
      return
    }
    if (password.length < 4) {
      window.alert('Please enter a password.')
      return
    }
    // Sign in with email and pass.
    // [START createwithemail]
    firebase.auth().createUserWithEmailAndPassword(email, password).catch(function (error) {
      // Handle Errors here.
      var errorCode = error.code
      var errorMessage = error.message
      // [START_EXCLUDE]
      if (errorCode === 'auth/weak-password') {
        window.alert('The password is too weak.')
      } else {
        window.alert(errorMessage)
      }
      console.log(error)
    // [END_EXCLUDE]
    })
  // [END createwithemail]
  }

  /**
   * Sends an email verification to the user.
   */
  function sendEmailVerification () {
    // [START sendemailverification]
    firebase.auth().currentUser.sendEmailVerification().then(function () {
      // Email Verification sent!
      // [START_EXCLUDE]
      window.alert('Email Verification Sent!')
    // [END_EXCLUDE]
    })
  // [END sendemailverification]
  }

  function sendPasswordReset () {
    var email = document.getElementById('email').value
    // [START sendpasswordemail]
    firebase.auth().sendPasswordResetEmail(email).then(function () {
      // Password Reset Email Sent!
      // [START_EXCLUDE]
      window.alert('Password Reset Email Sent!')
    // [END_EXCLUDE]
    }).catch(function (error) {
      // Handle Errors here.
      var errorCode = error.code
      var errorMessage = error.message
      // [START_EXCLUDE]
      if (errorCode === 'auth/invalid-email') {
        window.alert(errorMessage)
      } else if (errorCode === 'auth/user-not-found') {
        window.alert(errorMessage)
      }
      console.log(error)
    // [END_EXCLUDE]
    })
  // [END sendpasswordemail]
  }

  /**
   * initApp handles setting up UI event listeners and registering Firebase auth listeners:
   *  - firebase.auth().onAuthStateChanged: This listener is called when the user is signed in or
   *    out, and that is where we update the UI.
   */
  function initApp () {
    // Listening for auth state changes.
    // [START authstatelistener]
    firebase.auth().onAuthStateChanged(function (user) {
      // [START_EXCLUDE silent]
      document.getElementById('quickstart-verify-email').disabled = true
      // [END_EXCLUDE]
      if (user) {
        // User is signed in.
        var emailVerified = user.emailVerified
        // [START_EXCLUDE silent]
        document.getElementById('quickstart-sign-in').textContent = 'Sign out'
        document.getElementById('email').disabled = true
        document.getElementById('password').disabled = true
        document.getElementById('quickstart-sign-up').disabled = true
        document.getElementById('quickstart-password-reset').disabled = true
        if (!emailVerified) {
          document.getElementById('quickstart-verify-email').disabled = false
        }
      // [END_EXCLUDE]
      } else {
        // User is signed out.
        // [START_EXCLUDE silent]
        document.getElementById('quickstart-sign-in').textContent = 'Sign in'
        document.getElementById('email').disabled = false
        document.getElementById('password').disabled = false
        document.getElementById('quickstart-sign-up').disabled = false
        document.getElementById('quickstart-password-reset').disabled = false
      // [END_EXCLUDE]
      }
      // [START_EXCLUDE silent]
      document.getElementById('quickstart-sign-in').disabled = false
    // [END_EXCLUDE]
    })
    // [END authstatelistener]

    document.getElementById('quickstart-sign-in').addEventListener('click', toggleSignIn, false)
    document.getElementById('quickstart-sign-up').addEventListener('click', handleSignUp, false)
    document.getElementById('quickstart-verify-email').addEventListener('click', sendEmailVerification, false)
    document.getElementById('quickstart-password-reset').addEventListener('click', sendPasswordReset, false)
  }

  window.onload = function () {
    initApp()
  }
})(window.jQuery)
