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
  var firebaseConnected = false

  function getInitialValue () {
    var initialValue =
      '# Welcome to Tab-Notes\n\n' +
      '  Trained to understand Markdown, Tab-Notes will keep your:\n\n' +
      '  - thoughts\n' +
      '  - to-dos\n' +
      '  - memos\n\n' +
      '  __Always ready for you!__\n\n' +
      '  Based on http://simplemde.com/, with my personal set of improvements, it will help you be more organized.\n\n' +
      '  - [x] Read introduction\n' +
      '  - [ ] Click on a to-do to mark is as done\n' +
      '  - [ ] Be more productive\n'

    var localContent = localStorage.getItem('content')
    var localChanged = localStorage.getItem('changed')

    if (localContent !== null && localChanged !== null) {
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
      'drawLink': null
    },
    'status': false,
    'spellChecker': false,
    'toolbar': false
  })

  var deleteOldRevisions = function () {
    // Loop through every revision in order to clear space
    var limit = 1024 * 1024 * 1 // 1024 * 1024 = 1 MB
    var remSpace = limit - unescape(encodeURIComponent(JSON.stringify(localStorage))).length

    if (remSpace < 0) {
      var i
      var key
      var revision
      var revisions = []
      // Get Revisions in array
      for (i = 0; i < localStorage.length; i++) {
        key = localStorage.key(i)
        if (key && key.substring(0, 3) === 'rev') {
          revisions[i] = key
        }
      }
      revisions = revisions.sort()
      for (i = 0; i < revisions.length; i++) {
        key = revisions[i]
        revision = localStorage.getItem(key)
        remSpace += unescape(encodeURIComponent(JSON.stringify({key: revision}))).length
        localStorage.removeItem(key)
        if (remSpace > 0) break
      }
    }
  }

  var saveNewLocalRevision = function (content, date, timeout) {
    timeout = timeout || 500

    clearTimeout(saveNewLocalRevision.timerId)

    saveNewLocalRevision.TimerId = setTimeout(function () {
      localStorage.setItem('rev-' + date, content)
      deleteOldRevisions()
    }, timeout)
  }

  var saveToFirebase = function (content, date, timeout) {
    timeout = timeout || 2000

    clearTimeout(saveToFirebase.timerId)

    var user = firebase.auth().currentUser
    if (!user) return

    $('#sync-status').addClass('writing')

    saveToFirebase.timerId = setTimeout(function () {
      database.ref('users/' + user.uid + '/note').set({
        'content': content,
        'changed': changed
      }).then(function () {
        $('#sync-status').removeClass('writing')
      })
    }, timeout)
  }

  simplemde.codemirror.on('changes', function () {
    var content = simplemde.value()

    if (!syncSource) {
      changed = +new Date()
    }

    if (syncSource !== 'firebase') {
      saveToFirebase(content, changed)
    }

    saveNewLocalRevision(content, changed)

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
   * Sync status
   */
  $('#sync-status').click(function () {
    var $wrapper = $('#firebase-auth-wrapper')
    $wrapper.toggleClass('open')
  })

  window.SimpleMDE.prototype.togglePreviewOld = window.SimpleMDE.prototype.togglePreview

  window.SimpleMDE.prototype.togglePreview = function () {
    var cm = this.codemirror
    var wrapper = cm.getWrapperElement()
    var preview = wrapper.lastChild
    $('body').toggleClass('tab-notes-editor-preview-active', !/editor-preview-active/.test(preview.className))
    this.togglePreviewOld()
  }

  $('#print-icon').click(function () {
    simplemde.togglePreview()
  })

  function toggleSyncStatus () {
    $('#sync-status').removeClass()
    var user = firebase.auth().currentUser
    if (user) {
      if (!user.emailVerified) {
        $('#sync-status').addClass('warning')
      } else if (firebaseConnected) {
        $('#sync-status').addClass('syncing')
      } else {
        $('#sync-status').addClass('error')
      }
    }
  }

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
      firebase.auth().signInWithEmailAndPassword(email, password).then(function (user) {
        database.ref('users/' + user.uid + '/note/content').once('value').then(function (snapshot) {
          // Mix Local and Cloud notes.
          var firebaseContent = snapshot.val()
          var localContent = localStorage.getItem('content')

          document.getElementById('email').value = ''
          document.getElementById('password').value = ''

          if (firebaseContent !== localContent) {
            var content =
            '    ** ----------------------- **\n' +
            '    ** Beginning of Local note **\n' +
            '    ** ' + new Date().toLocaleDateString() + '\n' +
            '    ** ----------------------- **\n\n' +
            firebaseContent + '\n\n' +
            '-\n\n' +
            '    ** ----------------------- **\n' +
            '    ** Beginning of Cloud note **\n' +
            '    ** ' + new Date().toLocaleDateString() + '\n' +
            '    ** ----------------------- **\n\n' +
            localContent + '\n'

            simplemde.codemirror.setValue(content)
            window.alert('Both your local and you cloud notes are shown in your notepad, you can now review them and update as appropiate.')
          }
          $('#sync-status').click()
        })
      }).catch(function (error) {
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
    firebase.auth().createUserWithEmailAndPassword(email, password).then(function (user) {
      if (!user.emailVerified) {
        sendEmailVerification()
      }
    }).catch(function (error) {
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
      toggleSyncStatus()
    })
    // [END authstatelistener]

    var connectedRef = firebase.database().ref('.info/connected')
    connectedRef.on('value', function (snap) {
      firebaseConnected = snap.val()
      toggleSyncStatus()
    })

    document.getElementById('quickstart-sign-in').addEventListener('click', toggleSignIn, false)
    document.getElementById('quickstart-sign-up').addEventListener('click', handleSignUp, false)
    document.getElementById('quickstart-verify-email').addEventListener('click', sendEmailVerification, false)
    document.getElementById('quickstart-password-reset').addEventListener('click', sendPasswordReset, false)
  }

  window.onload = function () {
    initApp()
  }
})(window.jQuery)
