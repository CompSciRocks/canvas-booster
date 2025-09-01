
const csrClassQuiz = {
    init: function () {
        // Initialize the quiz functionality
        let divQuestionEditing = document.querySelector('div.add_question');

        if (divQuestionEditing) {

            // Make the modal
            let formContent = `
    <div title="Import QTI Questions" id="csr-import" class="csr-hidden">
        <div>
            <h4>Upload QTI Zip File</h4>
            <p>
            Select the QTI zip file to upload and import into this quiz. If the zip has groups of questions they'll be imported as new groups. If you'd rather import into an existing group use the icon in the right toolbar for that group.
            </p>
            <p>
            This does not currently support images, and only supports multiple choice questions. 
            </p>
        </div>

        <div style="margin-top: 20px; margin-bottom: 20px;" class="csr-form-grid">
            <div>    
                QTI Zip File
            </div>
            <div>
                <input type="file" id="csr-qti-file" name="csr-qti-file" accept=".zip">
            </div>

            <div>
                Group
            </div>
            <div>
                <select id="csr-question-group" name="csr-question-group"></select>
            </div>

        </div>

        <div class="csr-buttons">
            <div>
                <div style="width:100%;flex-grow: 1;">
                    <progress id="csr-upload-progress" value="37" max="100" style="width:90%;margin: 0 auto;" class="csr-hidden"></progress>
                    <span id="csr-upload-message" style="width:90%;margin: 0 auto;display:block;text-align:left;" class="csr-hidden"></span>
                </div>
            </div>
            <div style="flex-grow: 0;" class="csr-nowrap">
                <a class="btn" id="csr-upload-cancel" style="margin-right:16px;">Cancel</a>
                <a class="btn btn-primary" id="csr-upload-qti">Upload</a>
            </div>  
        </div>
    </div>
`;

            // Append the modal content to the body
            let divForm = document.createElement('div');
            divForm.innerHTML = formContent;
            document.getElementById('questions_tab').appendChild(divForm);

            // make a new button
            let lnk = document.createElement('a');
            lnk.className = 'btn import_questions';
            lnk.style.marginLeft = '20px';
            lnk.href = '#';
            lnk.innerHTML = '<i class="icon-upload"></i> Import';
            lnk.id = 'csr-open-import';

            // append the button to the div
            divQuestionEditing.appendChild(lnk);

            document.getElementById('csr-open-import').addEventListener('click', function (e) {
                e.preventDefault();
                let elDialog = document.getElementById('csr-import');
                elDialog.classList.toggle('csr-hidden');

                // If visible
                if (!elDialog.classList.contains('csr-hidden')) {
                    let elSelect = document.getElementById('csr-question-group');
                    let groups = csrClassQuiz.getGroups();

                    // Append groups to the #csr-question-group select
                    elSelect.innerHTML = '<option value="">No Group</option>';
                    groups.then((data) => {
                        console.info(data);
                        data.forEach((group) => {
                            let option = document.createElement('option');
                            option.value = group.id;
                            option.textContent = group.name;
                            elSelect.appendChild(option);
                        });
                    });

                }



            });

            document.getElementById('csr-upload-cancel').addEventListener('click', function (e) {
                // Reset form
                document.getElementById('csr-qti-file').value = '';
                document.getElementById('csr-question-group').selectedIndex = 0;
                document.getElementById('csr-import').classList.add('csr-hidden');
            });

            document.getElementById('csr-upload-qti').addEventListener('click', function () {
                csrClassQuiz.clickMain();
            });
        }

    },

    /**
     * Handle the click on the main upload button. Read zip file and hand off the 
     * contents to another function to process. 
     */
    clickMain: function () {
        const fileInput = document.getElementById('csr-qti-file');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a QTI zip file to upload.');
            return;
        }

        // Unzip the file and list contents to console
        const reader = new FileReader();
        reader.onload = function (event) {
            const zipData = event.target.result;
            JSZip.loadAsync(zipData).then(function (zip) {
                csrClassQuiz.processZip(zip, 1, 2);
            }).catch(function (error) {
                console.error('Error reading QTI zip file:', error);
                alert('Failed to read the QTI zip file. Please try again.');
            });
        };

        reader.onerror = function (error) {
            console.error('Error reading file:', error);
            alert('Failed to read the file. Please try again.');
        };

        // Read the file as an ArrayBuffer
        reader.readAsArrayBuffer(file);
    },

    /**
     * Unzips a QTI zip file and processes its contents, adding it based on the
     * Quiz Id and optional Group Id. 
     */
    processZip: function (zip, quizId, groupId) {
        // Load the contents of the files into a dictionary with the path/filename as key
        let contents = {};
        let promises = [];
        Object.keys(zip.files).forEach(function (filename) {
            if (!zip.files[filename].dir) { // Skip directories
                promises.push(zip.files[filename].async('text').then(function (content) {
                    contents[filename] = content;
                }));
            }
        });

        Promise.all(promises).then(function () {
            // Now we have all the contents in the contents object

            // Make sure there's a imsmanifest.xml file, if not bail
            if (!contents['imsmanifest.xml']) {
                alert('The QTI zip file does not contain a valid imsmanifest.xml file.');
                return;
            }

            // Process the contents
            csrClassQuiz.processContents(contents, quizId, groupId);
        }).catch(function (error) {
            console.error('Error processing QTI zip file contents:', error);
            alert('Failed to process the QTI zip file contents. Please try again.');
        });

    },

    /**
     * Given an object with keys for the contents of the zip file with contents, 
     * make the API calls to add the questions.
     */
    processContents: function (contents, quizId, groupId) {
        // Need a dom parser
        const parser = new DOMParser();
        // Parse the imsmanifest.xml file
        const manifestContent = contents['imsmanifest.xml'];
        const manifestDom = parser.parseFromString(manifestContent, 'application/xml');
        // Check for parsing errors
        const parserError = manifestDom.querySelector('parsererror');
        if (parserError) {
            console.error('Error parsing imsmanifest.xml:', parserError);
            alert('Failed to parse the imsmanifest.xml file. Please check the file format.');
            return;
        }

        const files = manifestDom.querySelectorAll('resources > resource[type="imsqti_xmlv1p2"] > file');
        if (files.length === 0) {
            alert('No questions found in the QTI zip file.');
            return;
        }


        let elStatus = document.getElementById('csr-upload-message');
        elStatus.classList.add('csr-hidden');
        elStatus.textContent = '';

        let elProgress = document.getElementById('csr-upload-progress');
        elProgress.setAttribute('value', '0');
        elProgress.setAttribute('max', files.length);
        elProgress.classList.remove('csr-hidden');

        // Loop through each file and process 
        let itemsProcessed = 0;
        files.forEach(function (file) {
            const href = file.getAttribute('href');
            if (contents[href]) {
                // Process the question file
                const fileContent = contents[href];
                const fileDom = parser.parseFromString(fileContent, 'application/xml');

                // Get the individual items from <section ident="root_section">
                const items = fileDom.querySelectorAll('section[ident="root_section"] > item');
                items.forEach(function (item) {
                    csrClassQuiz.submitQuestion(item, quizId, groupId);
                    elProgress.setAttribute('value', parseInt(elProgress.getAttribute('value')) + 1);
                    itemsProcessed += 1;
                });

            } else {
                console.warn(`File ${href} not found in the zip contents.`);
            }
        });

        elProgress.classList.add('csr-hidden');

        elStatus.textContent = itemsProcessed + ' questions uploaded. You may need to save or refresh the view to see the new questions.';
        elStatus.classList.remove('csr-hidden');

        // Reset the form
        document.getElementById('csr-qti-file').value = '';
        document.getElementById('csr-question-group').selectedIndex = 0;
    },


    /**
     * API call to add the question to the quiz
     */
    submitQuestion: function (item, quizId, groupId) {
        let questionOptions = {
            title: item.getAttribute('title') || 'Untitled Question',
        };

        let metaData = item.querySelectorAll('itemmetadata > qtimetadata > qtimetadatafield');
        metaData.forEach(function (field) {
            let fieldName = field.querySelector('fieldlabel').textContent.trim();
            let fieldValue = field.querySelector('fieldentry').textContent.trim();

            questionOptions[fieldName] = fieldValue;
        });

        let elGroupSelect = document.querySelector('#csr-question-group');

        let apiData = {
            'question_name': questionOptions.title,
            'question_text': item.querySelector('presentation > material > mattext').textContent.trim(),
            'question_type': '',
            'points_possible': parseInt(questionOptions.points_possible),
            'neutral_comments_html': item.querySelector('itemfeedback[ident="general_fb"] > flow_mat > material > mattext') ? item.querySelector('itemfeedback[ident="general_fb"] > flow_mat > material > mattext').textContent.trim() : '',
            'correct_comments_html': item.querySelector('itemfeedback[ident="correct_fb"] > flow_mat > material > mattext') ? item.querySelector('itemfeedback[ident="correct_fb"] > flow_mat > material > mattext').textContent.trim() : '',
            'incorrect_comments_html': item.querySelector('itemfeedback[ident="general_incorrect_fb"] > flow_mat > material > mattext') ? item.querySelector('itemfeedback[ident="general_incorrect_fb"] > flow_mat >  material > mattext').textContent.trim() : '',
            'quiz_group_id': elGroupSelect.value == '' ? null : parseInt(elGroupSelect.value),
            'position': null
        };

        if (questionOptions.question_type == 'multiple_choice_question') {
            apiData.question_type = 'multiple_choice_question';

            // Get the answer choices and add them to apiData
            apiData.answers = [];
            let answerIds = questionOptions.original_answer_ids.split(/,/);
            console.info(answerIds);

            answerIds.forEach(function (id) {

                // Go through and find the linkrefid for this answer choice
                let respConditions = item.querySelectorAll('respcondition');
                let answerFeedback = '';
                let answerWeight = 0;
                respConditions.forEach(function (respCondition) {
                    let foundId = respCondition.querySelector('conditionvar > varequal')?.textContent.trim();

                    if (foundId !== undefined && foundId !== null && foundId == id.trim()) {
                        let feedbackId = respCondition.querySelector('displayfeedback')?.getAttribute('linkrefid');
                        if (feedbackId) {
                            let feedbackText = item.querySelector('itemfeedback[ident="' + feedbackId + '"] > flow_mat > material > mattext');
                            if (feedbackText) {
                                answerFeedback = feedbackText.textContent.trim();
                            }
                        }

                        let weightText = respCondition.querySelector('setvar[varname="SCORE"]');
                        if (weightText) {
                            answerWeight = parseFloat(weightText.textContent.trim());
                        }
                    }
                });

                let answerChoice = {
                    'answer_html': item.querySelector('response_lid > render_choice > response_label[ident="' + id.trim() + '"] > material > mattext').textContent.trim(),
                    'answer_weight': answerWeight,
                    'answer_comments': answerFeedback,
                };
                apiData.answers.push(answerChoice);
            });
        } else {
            console.error(`Unsupported question type: ${questionOptions.questionType}`);
            return;
        }

        // Build the URL
        let matchCourse = window.location.pathname.match(/\/courses\/(\d+)/);
        let courseID = matchCourse ? matchCourse[1] : null;
        let matchQuiz = window.location.pathname.match(/\/quizzes\/(\d+)/);
        let quizID = matchQuiz ? matchQuiz[1] : quizId;
        let host = window.location.protocol + '//' + window.location.host;
        let apiUrl = `${host}/api/v1/courses/${courseID}/quizzes/${quizID}/questions`;

        apiData.quiz_id = parseInt(quizID); // Add quiz ID to the data

        // Post to API
        apiData = {
            'question': apiData
        };

        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'X-CSRF-Token': csrClassQuiz.csrfToken()
            },
            body: JSON.stringify(apiData),
        }).then(function (response) {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('Failed to add question: ' + response.statusText);
            }
        }).then(function (data) {
            console.log('Question added successfully:', data);

            // Optionally, you can reload the page or update the UI to reflect the new question
            // window.location.reload();
        }).catch(function (error) {
            console.error('Error adding question:', error);
            alert('Failed to add question: ' + error.message);
        });

    },

    /**
     * @see https://community.canvaslms.com/t5/Developers-Group/422-Error-when-making-POST-Request-to-Favorite-Courses-API/m-p/599003
     */
    csrfToken: () => {
        return decodeURIComponent((document.cookie.match('(^|;) *_csrf_token=([^;]*)') || '')[2])
    },


    getGroups: async () => {

        let els = document.querySelectorAll('.update_group_url');
        let groups = [];

        await Promise.all([...els].map(async (el) => {
            let url = el.getAttribute('href');
            let match = url.match(/\/courses\/(\d+)\/quizzes\/(\d+)\/groups\/(\d+)/);
            if (match) {
                let apiUrl = window.location.protocol + '//' + window.location.host + '/api/v1/courses/' + match[1] + '/quizzes/' + match[2] + '/groups/' + match[3];


                let response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'accept': 'application/json',
                        'X-CSRF-Token': csrClassQuiz.csrfToken()
                    }
                });

                let data = await response.json();

                groups.push({
                    id: data.id,
                    name: data.name,
                    quiz_id: data.quiz_id
                });
            }
        }));
        return groups;
    }
}

csrClassQuiz.init();


// Add listener to upload
//     document.getElementById('csr-upload-qti').addEventListener('click', function () {

//         const fileInput = document.getElementById('csr-qti-file');
//         const file = fileInput.files[0];

//         if (!file) {
//             alert('Please select a QTI zip file to upload.');
//             return;
//         }

//         // Unzip the file and list contents to console
//         const reader = new FileReader();
//         reader.onload = function (event) {
//             const zipData = event.target.result;
//             JSZip.loadAsync(zipData).then(function (zip) {
//                 console.log('Contents of the QTI zip file:');
//                 Object.keys(zip.files).forEach(function (filename) {
//                     console.log(filename);
//                 });

//                 // Trigger the save and reload
//                 // window.location.reload();
//             }).catch(function (error) {
//                 console.error('Error reading QTI zip file:', error);
//                 alert('Failed to read the QTI zip file. Please try again.');
//             });
//         };

//         reader.onerror = function (error) {
//             console.error('Error reading file:', error);
//             alert('Failed to read the file. Please try again.');
//         };

//         // Read the file as an ArrayBuffer
//         reader.readAsArrayBuffer(file);


//     });
// }