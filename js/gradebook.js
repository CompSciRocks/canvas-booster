let matchCourse = window.location.pathname.match(/\/courses\/(\d+)/);
let courseID = matchCourse ? matchCourse[1] : null;

let host = window.location.protocol + '//' + window.location.host;

let interval = setInterval(function () {
    let lateEls = document.querySelectorAll('.gradebook-cell.late');
    lateEls.forEach(function (el) {
        let endEl = el.querySelector('.Grid__GradeCell__EndContainer');
        if (endEl.innerHTML.trim() == '') {
            let parentCell = endEl.closest('.slick-cell');
            let assignmentID = '';
            if (parentCell) {
                parentCell.classList.forEach(function (className) {
                    if (className.includes('assignment_')) {
                        assignmentID = className.replace('assignment_', '');
                    }
                });
            }

            let studentID = '';
            let studentEl = endEl.closest('.slick-row');
            if (studentEl) {
                studentEl.classList.forEach(function (className) {
                    if (className.includes('student_')) {
                        studentID = className.replace('student_', '');
                    }
                });
            }


            if (studentID && assignmentID) {
                let url = `${host}/api/v1/courses/${courseID}/assignments/${assignmentID}/submissions/${studentID}`;
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data.late) {
                            let daysLate = Math.round(data.seconds_late / 60 / 60 / 24 * 100) / 100;
                            endEl.innerHTML = '<span style="font-size:75%;">(' + daysLate + ')</span>';
                        }
                    });
            }
        }
    });
}, 2_500);